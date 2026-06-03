import type { Schema } from '../../data/resource'

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { createHash, randomUUID } from 'node:crypto'
import { XMLParser } from 'fast-xml-parser'

type IdentityLike = {
  claims?: Record<string, unknown>
}

type ExternalApiLike = {
  id: string
  name?: string
  kind?: string
  baseUrl?: string | null
  authType?: string | null
  secretName?: string | null
  configJson?: string | null
  enabled?: boolean | null
}

type SipSASyncConfig = {
  endpoint?: string
  methods?: Array<
    | 'promediosSipsaCiudad'
    | 'consultarInsumosSipsaMesMadr'
    | 'promediosSipsaSemanaMadr'
    | 'promediosSipsaMesMadr'
    | 'promedioAbasSipsaMesMadr'
  >
  municipioAllowlist?: string[]
  productAllowlist?: string[]
  maxRecordsPerMethod?: number
  forceHttps?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function toDateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const s = value.trim()
  if (!s) return null
  // SOAP returns ISO-like strings with timezone; we only need YYYY-MM-DD.
  if (s.length >= 10 && /\d{4}-\d{2}-\d{2}/.test(s.slice(0, 10))) return s.slice(0, 10)
  return null
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function stableId(parts: string[]): string {
  const raw = parts.join('|')
  return createHash('sha256').update(raw).digest('hex')
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
})

function buildSoap12Envelope(opName: string): string {
  const ns = 'http://servicios.sipsa.co.gov.dane/'
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
    'xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" ' +
    `xmlns:tns="${ns}">` +
    '<soap12:Body>' +
    `<tns:${opName}/>` +
    '</soap12:Body>' +
    '</soap12:Envelope>'
  )
}

function parseReturnFragment(fragmentXml: string): unknown | null {
  // fragmentXml is expected to be something like: <return>...</return>
  const parsed = xmlParser.parse(fragmentXml)
  if (!isRecord(parsed)) return null
  const record = parsed.return
  if (!isRecord(record)) return null
  return record
}

async function soapCall(params: {
  endpoint: string
  opName: string
  timeoutMs: number
  maxReturns: number
}): Promise<unknown[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), params.timeoutMs)
  try {
    const resp = await fetch(params.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/soap+xml; charset=utf-8',
        accept: 'application/soap+xml, text/xml, application/xml',
      },
      body: buildSoap12Envelope(params.opName),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`HTTP ${resp.status} calling ${params.opName}: ${text.slice(0, 500)}`)
    }

    if (!resp.body) {
      // Extremely unlikely in Node runtimes, but keep a safe fallback.
      const text = await resp.text()
      // Best-effort extraction without full SOAP unwrapping: if this happens,
      // we are already holding the whole response.
      const start = text.indexOf('<return')
      const out: unknown[] = []
      if (start < 0) return out
      const endTag = '</return>'
      let cursor = 0
      while (out.length < params.maxReturns) {
        const s = text.indexOf('<return', cursor)
        if (s < 0) break
        const e = text.indexOf(endTag, s)
        if (e < 0) break
        const frag = text.slice(s, e + endTag.length)
        const rec = parseReturnFragment(frag)
        if (rec) out.push(rec)
        cursor = e + endTag.length
      }
      return out
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder('utf-8')
    const endTag = '</return>'

    let buffer = ''
    const out: unknown[] = []

    while (out.length < params.maxReturns) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Prevent unbounded growth if we haven't seen a <return yet.
      if (buffer.length > 200_000 && buffer.indexOf('<return') < 0) {
        buffer = buffer.slice(-2_000)
      }

      while (out.length < params.maxReturns) {
        const start = buffer.indexOf('<return')
        if (start < 0) break

        // Drop anything before the tag to keep memory in check.
        if (start > 0) buffer = buffer.slice(start)

        const startTagEnd = buffer.indexOf('>')
        if (startTagEnd < 0) break

        const end = buffer.indexOf(endTag, startTagEnd)
        if (end < 0) break

        const frag = buffer.slice(0, end + endTag.length)
        buffer = buffer.slice(end + endTag.length)

        const rec = parseReturnFragment(frag)
        if (rec) out.push(rec)
      }
    }

    // Stop downloading once we've collected enough.
    if (out.length >= params.maxReturns) {
      controller.abort()
    }

    return out
  } finally {
    clearTimeout(timer)
  }
}

async function upsertPriceReference(item: {
  id: string
  product: string
  municipio?: string | null
  market?: string | null
  date: string
  price: number
  unit?: string | null
  countryCode?: string | null
  sourceApiId?: string | null
}) {
  const table = requiredEnv('PRICE_REFERENCE_TABLE')
  const now = new Date().toISOString()

  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { id: item.id },
      UpdateExpression:
        'SET #p = :p, #d = :d, #pr = :pr, #u = :u, #m = :m, #mk = :mk, #cc = :cc, #sid = :sid, #updatedAt = :updatedAt, #createdAt = if_not_exists(#createdAt, :createdAt)',
      ExpressionAttributeNames: {
        '#p': 'product',
        '#d': 'date',
        '#pr': 'price',
        '#u': 'unit',
        '#m': 'municipio',
        '#mk': 'market',
        '#cc': 'countryCode',
        '#sid': 'sourceApiId',
        '#createdAt': 'createdAt',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':p': item.product,
        ':d': item.date,
        ':pr': item.price,
        ':u': item.unit ?? null,
        ':m': item.municipio ?? null,
        ':mk': item.market ?? null,
        ':cc': item.countryCode ?? 'CO',
        ':sid': item.sourceApiId ?? null,
        ':createdAt': now,
        ':updatedAt': now,
      },
    })
  )
}

async function putJob(params: { apiId: string; status: 'RUNNING' | 'SUCCESS' | 'FAILED'; summary?: string; error?: string }) {
  const table = requiredEnv('EXTERNAL_SYNC_JOB_TABLE')
  const now = new Date().toISOString()
  const id = randomUUID()

  await ddb.send(
    new PutCommand({
      TableName: table,
      Item: {
        id,
        apiId: params.apiId,
        status: params.status,
        startedAt: now,
        endedAt: params.status === 'RUNNING' ? null : now,
        summary: params.summary ?? null,
        error: params.error ?? null,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: { '#id': 'id' },
    })
  )

  return id
}

async function finishJob(params: { jobId: string; status: 'SUCCESS' | 'FAILED'; summary?: string; error?: string }) {
  const table = requiredEnv('EXTERNAL_SYNC_JOB_TABLE')
  const now = new Date().toISOString()
  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { id: params.jobId },
      UpdateExpression: 'SET #s = :s, #endedAt = :e, #summary = :sum, #error = :err, #updatedAt = :u',
      ExpressionAttributeNames: {
        '#s': 'status',
        '#endedAt': 'endedAt',
        '#summary': 'summary',
        '#error': 'error',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':s': params.status,
        ':e': now,
        ':sum': params.summary ?? null,
        ':err': params.error ?? null,
        ':u': now,
      },
    })
  )
}

function getGroups(identity: IdentityLike | undefined): string[] {
  const raw = identity?.claims?.['cognito:groups']
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string') as string[]
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((s) => s.trim())
  return []
}

function isAdmin(identity: IdentityLike | undefined): boolean {
  const groups = getGroups(identity)
  return groups.includes('ADMIN') || groups.includes('STAFF')
}

function parseConfig(externalApi: ExternalApiLike): SipSASyncConfig {
  if (!externalApi.configJson || typeof externalApi.configJson !== 'string') return {}
  const parsed = safeJsonParse(externalApi.configJson)
  if (!isRecord(parsed)) return {}
  return parsed as SipSASyncConfig
}

function coerceEndpoint(externalApi: ExternalApiLike, cfg: SipSASyncConfig): string {
  const fallback = 'https://appweb.dane.gov.co/sipsaWS/SrvSipsaUpraBeanService'
  const raw = (cfg.endpoint ?? externalApi.baseUrl ?? fallback).trim()
  const noQuery = raw.split('?')[0]
  const forceHttps = cfg.forceHttps ?? true
  if (!forceHttps) return noQuery
  return noQuery.replace(/^http:\/\//i, 'https://')
}

function allowlistMatch(value: string | null | undefined, allowlist: string[] | undefined): boolean {
  if (!allowlist || allowlist.length === 0) return true
  if (!value) return false
  const key = normalizeKey(value)
  return allowlist.map(normalizeKey).includes(key)
}

function pickString(record: unknown, key: string): string | null {
  if (!isRecord(record)) return null
  const v = record[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function pickNumber(record: unknown, key: string): number | null {
  if (!isRecord(record)) return null
  return toNumber(record[key])
}

type MappedRef = {
  id: string
  product: string
  municipio?: string | null
  market?: string | null
  date: string
  price: number
  unit?: string | null
}

function mapSipsaRecord(opName: string, apiId: string, record: unknown): MappedRef | null {
  if (!isRecord(record)) return null

  if (opName === 'promediosSipsaCiudad') {
    const product = pickString(record, 'producto')
    const municipio = pickString(record, 'ciudad')
    const price = pickNumber(record, 'precioPromedio')
    const date = toDateOnly(record.fechaCaptura) ?? toDateOnly(record.fechaCreacion)
    if (!product || !municipio || price == null || !date) return null
    return {
      id: stableId([apiId, opName, product, municipio, date]),
      product,
      municipio,
      market: 'SIPSA - Ciudad',
      date,
      price,
      unit: 'COP/kg',
    }
  }

  if (opName === 'consultarInsumosSipsaMesMadr') {
    const product = pickString(record, 'insumoNombre')
    const municipio = pickString(record, 'muniNombre')
    const dept = pickString(record, 'deptNombre')
    const price = pickNumber(record, 'promedio')
    const date = toDateOnly(record.fechaMesIni)
    if (!product || !municipio || price == null || !date) return null
    const market = dept ? `SIPSA - Insumos (${dept})` : 'SIPSA - Insumos'
    return {
      id: stableId([apiId, opName, product, municipio, market, date]),
      product,
      municipio,
      market,
      date,
      price,
      unit: 'COP',
    }
  }

  if (opName === 'promediosSipsaSemanaMadr') {
    const product = pickString(record, 'artiNombre')
    const market = pickString(record, 'fuenNombre')
    const price = pickNumber(record, 'promedioKg')
    const date = toDateOnly(record.fechaIni)
    if (!product || !market || price == null || !date) return null
    return {
      id: stableId([apiId, opName, product, market, date]),
      product,
      market,
      date,
      price,
      unit: 'kg',
    }
  }

  if (opName === 'promediosSipsaMesMadr') {
    const product = pickString(record, 'artiNombre')
    const market = pickString(record, 'fuenNombre')
    const price = pickNumber(record, 'promedioKg')
    const date = toDateOnly(record.fechaMesIni)
    if (!product || !market || price == null || !date) return null
    return {
      id: stableId([apiId, opName, product, market, date]),
      product,
      market,
      date,
      price,
      unit: 'kg',
    }
  }

  if (opName === 'promedioAbasSipsaMesMadr') {
    const product = pickString(record, 'artiNombre')
    const market = pickString(record, 'fuenNombre')
    const price = pickNumber(record, 'cantidadTon')
    const date = toDateOnly(record.fechaMesIni)
    if (!product || !market || price == null || !date) return null
    return {
      id: stableId([apiId, opName, product, market, date]),
      product,
      market,
      date,
      price,
      unit: 'ton',
    }
  }

  return null
}

async function loadExternalApi(apiId: string): Promise<ExternalApiLike> {
  const table = requiredEnv('EXTERNAL_API_TABLE')
  const resp = await ddb.send(new GetCommand({ TableName: table, Key: { id: apiId } }))
  if (!isRecord(resp.Item)) throw new Error('ExternalApi not found')
  return resp.Item as ExternalApiLike
}

export const handler: Schema['syncExternalApiNow']['functionHandler'] = async (event) => {
  const apiId = String(event.arguments.apiId)
  const identity = event.identity as unknown as IdentityLike | undefined

  if (!isAdmin(identity)) {
    throw new Error('Not authorized')
  }

  const externalApi = await loadExternalApi(apiId)
  if (externalApi.enabled === false) {
    return `ExternalApi ${apiId} disabled`
  }

  const cfg = parseConfig(externalApi)
  const endpoint = coerceEndpoint(externalApi, cfg)
  const methods =
    cfg.methods && cfg.methods.length > 0
      ? cfg.methods
      : [
          'promediosSipsaCiudad',
          'consultarInsumosSipsaMesMadr',
          'promediosSipsaSemanaMadr',
          'promediosSipsaMesMadr',
          'promedioAbasSipsaMesMadr',
        ]

  const maxRecords = Math.max(1, Math.min(2000, cfg.maxRecordsPerMethod ?? 500))
  const municipioAllowlist = cfg.municipioAllowlist
  const productAllowlist = cfg.productAllowlist

  const jobId = await putJob({ apiId, status: 'RUNNING', summary: `SIPSA sync started (${methods.length} métodos)` })

  let written = 0
  const perMethodCounts: Record<string, number> = {}

  try {
    for (const opName of methods) {
      const limited = await soapCall({ endpoint, opName, timeoutMs: 45_000, maxReturns: maxRecords })

      let methodWritten = 0
      for (const record of limited) {
        const mapped = mapSipsaRecord(opName, apiId, record)
        if (!mapped) continue
        if (!allowlistMatch(mapped.municipio ?? null, municipioAllowlist)) continue
        if (!allowlistMatch(mapped.product, productAllowlist)) continue

        await upsertPriceReference({
          ...mapped,
          countryCode: 'CO',
          sourceApiId: apiId,
        })
        written += 1
        methodWritten += 1
      }

      perMethodCounts[opName] = methodWritten
    }

    const summary = JSON.stringify({ ok: true, endpoint, methods: perMethodCounts, written })
    await finishJob({ jobId, status: 'SUCCESS', summary })
    return summary
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const summary = JSON.stringify({ ok: false, endpoint, methods: perMethodCounts, written })
    await finishJob({ jobId, status: 'FAILED', summary, error: msg })
    throw e
  }
}
