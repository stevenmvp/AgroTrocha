import type { Schema } from '../../data/resource'
import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'

type ExternalApiItem = {
  id: string
  name?: string
  kind?: string
  baseUrl?: string
  authType?: string
  secretName?: string
  enabled?: boolean
}

type PriceRow = {
  product: string
  countryCode?: string
  municipio?: string
  market?: string
  date: string
  price: number
  unit?: string
  sourceApiId: string
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

function getClaimString(claims: Record<string, unknown> | undefined, key: string): string | null {
  const value = claims?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isAdminCaller(event: unknown): boolean {
  const root = asRecord(event)
  const identity = asRecord(root?.identity)
  const claims = asRecord(identity?.claims) ?? undefined
  const customRole = (getClaimString(claims, 'custom:role') ?? '').toUpperCase()
  const groupsRaw = claims?.['cognito:groups']
  const groups = Array.isArray(groupsRaw)
    ? groupsRaw.map((g) => String(g))
    : typeof groupsRaw === 'string'
      ? groupsRaw
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      : []

  return groups.includes('ADMIN') || groups.includes('STAFF') || customRole === 'ADMIN'
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toIsoDate(value: unknown): string | null {
  const raw = asString(value)
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const rec = asRecord(value)
  if (!rec) return []
  const direct = ['data', 'rows', 'items', 'records', 'result']
  for (const key of direct) {
    const item = rec[key]
    if (Array.isArray(item)) return item
    const nested = asRecord(item)
    if (!nested) continue
    for (const nestedKey of ['rows', 'items', 'records', 'data']) {
      if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as unknown[]
    }
  }
  return []
}

function pickField(row: Record<string, unknown>, options: string[]): unknown {
  const entries = Object.entries(row)
  for (const option of options) {
    const normOption = normalizeText(option)
    const hit = entries.find(([key]) => normalizeText(key) === normOption)
    if (hit) return hit[1]
  }
  return undefined
}

function normalizeInputRow(row: Record<string, unknown>, apiId: string): PriceRow | null {
  const product =
    asString(pickField(row, ['product', 'name', 'producto', 'nombre_producto', 'articulo'])) ?? null
  const municipio =
    asString(pickField(row, ['municipio', 'city', 'ciudad', 'nom_mpio', 'ciudad_municipio'])) ?? null
  const market = asString(pickField(row, ['market', 'mercado', 'plaza', 'fuente']))
  const countryCode = asString(pickField(row, ['countryCode', 'pais', 'country'])) ?? 'CO'
  const unit = asString(pickField(row, ['unit', 'unidad', 'unidad_medida', 'presentacion'])) ?? 'kg'
  const date = toIsoDate(pickField(row, ['date', 'fecha', 'fecha_reporte', 'fecha_captura']))
  const price = asNumber(pickField(row, ['price', 'precio', 'valor', 'precio_promedio', 'precio_mayorista']))

  if (!product || !date || price === null) return null

  return {
    product,
    countryCode,
    municipio: municipio ?? 'N/A',
    market: market ?? 'General',
    date,
    price,
    unit,
    sourceApiId: apiId,
  }
}

function buildSeedRows(apiId: string): PriceRow[] {
  const today = new Date()
  const products = ['Papa', 'Cebolla', 'Tomate', 'Zanahoria', 'Yuca', 'Aguacate']
  const municipios = ['Tunja', 'Duitama', 'Sogamoso', 'Aquitania', 'Paipa']
  const rows: PriceRow[] = []

  for (let i = 0; i < 20; i += 1) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    rows.push({
      product: products[i % products.length],
      countryCode: 'CO',
      municipio: municipios[i % municipios.length],
      market: 'SISPA_FALLBACK',
      date: `${y}-${m}-${day}`,
      price: 900 + i * 35,
      unit: 'kg',
      sourceApiId: apiId,
    })
  }

  return rows
}

async function getApiConfig(apiId: string): Promise<ExternalApiItem> {
  const table = requiredEnv('EXTERNAL_API_TABLE')
  const res = await ddb.send(new GetCommand({ TableName: table, Key: { id: apiId } }))
  const item = asRecord(res.Item)
  if (!item) throw new Error(`ExternalApi not found for apiId=${apiId}`)
  return item as unknown as ExternalApiItem
}

async function insertPriceIfNotExists(row: PriceRow): Promise<boolean> {
  const table = requiredEnv('PRICE_REFERENCE_TABLE')
  const byMunicipio = await ddb.send(
    new QueryCommand({
      TableName: table,
      IndexName: 'listPricesByMunicipioAndDate',
      KeyConditionExpression: '#m = :m AND #d = :d',
      ExpressionAttributeNames: { '#m': 'municipio', '#d': 'date' },
      ExpressionAttributeValues: { ':m': row.municipio, ':d': row.date },
      Limit: 100,
    })
  )

  const duplicate = (byMunicipio.Items ?? []).some((x) => {
    const item = asRecord(x)
    if (!item) return false
    return (
      asString(item.product) === row.product &&
      asString(item.market) === row.market &&
      asString(item.sourceApiId) === row.sourceApiId
    )
  })

  if (duplicate) return false

  await ddb.send(
    new PutCommand({
      TableName: table,
      Item: {
        id: randomUUID(),
        product: row.product,
        countryCode: row.countryCode ?? null,
        municipio: row.municipio ?? null,
        market: row.market ?? null,
        date: row.date,
        price: row.price,
        unit: row.unit ?? null,
        sourceApiId: row.sourceApiId,
      },
    })
  )

  return true
}

async function createJob(apiId: string): Promise<string> {
  const table = requiredEnv('EXTERNAL_SYNC_JOB_TABLE')
  const id = randomUUID()
  const now = new Date().toISOString()
  await ddb.send(
    new PutCommand({
      TableName: table,
      Item: {
        id,
        apiId,
        status: 'RUNNING',
        startedAt: now,
        summary: 'Iniciando sincronización',
      },
    })
  )
  return id
}

async function closeJob(jobId: string, status: 'SUCCESS' | 'FAILED', summary: string, error?: string) {
  const table = requiredEnv('EXTERNAL_SYNC_JOB_TABLE')
  const now = new Date().toISOString()
  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { id: jobId },
      UpdateExpression: 'SET #s = :s, #e = :e, #sum = :sum, #err = :err',
      ExpressionAttributeNames: {
        '#s': 'status',
        '#e': 'endedAt',
        '#sum': 'summary',
        '#err': 'error',
      },
      ExpressionAttributeValues: {
        ':s': status,
        ':e': now,
        ':sum': summary,
        ':err': error ?? null,
      },
    })
  )
}

async function collectRowsFromApi(api: ExternalApiItem): Promise<{ rows: PriceRow[]; usedFallback: boolean }> {
  const apiId = String(api.id)
  const baseUrl = asString(api.baseUrl)
  if (!baseUrl) {
    return { rows: buildSeedRows(apiId), usedFallback: true }
  }

  try {
    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = (await response.json()) as unknown
    const rawRows = asArray(payload)
    const rows = rawRows
      .map((item) => normalizeInputRow(asRecord(item) ?? {}, apiId))
      .filter((item): item is PriceRow => item !== null)

    if (rows.length === 0) {
      return { rows: buildSeedRows(apiId), usedFallback: true }
    }
    return { rows, usedFallback: false }
  } catch {
    return { rows: buildSeedRows(apiId), usedFallback: true }
  }
}

/**
 * Sincronización de datos externos de mercado:
 * - Lee la configuración de ExternalApi.
 * - Consume baseUrl si está disponible.
 * - Si falla o no hay payload válido, usa fallback de datos semilla.
 * - Inserta en PriceReference evitando duplicados de negocio.
 * - Registra trazabilidad en ExternalSyncJob.
 */
export const handler: Schema['syncExternalApiNow']['functionHandler'] = async (event) => {
  if (!isAdminCaller(event)) {
    throw new Error('Not authorized: requiere rol ADMIN/STAFF para ejecutar sync directo')
  }

  const apiId = String(event.arguments.apiId)
  const jobId = await createJob(apiId)

  try {
    const api = await getApiConfig(apiId)
    if (api.enabled === false) {
      throw new Error('ExternalApi está deshabilitada')
    }

    const { rows, usedFallback } = await collectRowsFromApi(api)

    let created = 0
    let skipped = 0

    for (const row of rows) {
      const inserted = await insertPriceIfNotExists(row)
      if (inserted) created += 1
      else skipped += 1
    }

    const summary = `api=${apiId}; creados=${created}; duplicados=${skipped}; origen=${usedFallback ? 'fallback' : 'external'}`
    await closeJob(jobId, 'SUCCESS', summary)
    return summary
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await closeJob(jobId, 'FAILED', `api=${apiId}; error`, message)
    throw new Error(`Sync failed for apiId=${apiId}: ${message}`)
  }
}
