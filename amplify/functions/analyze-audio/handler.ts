import type { Schema } from '../../data/resource'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

type ParsedOrder = {
  product: string | null
  quantity: number | null
  unit: string | null
  pickupDate: string | null
  municipio: string | null
  missing: string[]
}

const SYSTEM_PROMPT = `Eres un experto en logística rural colombiana para AgroTrocha.
Tu tarea es convertir texto transcrito (proveniente de audios de productores) en datos estructurados.

Reglas:
- Responde SOLO con JSON válido.
- Si falta un campo requerido, usa null y agrega una clave "missing" con una lista de campos faltantes.
- Normaliza producto con primera letra mayúscula.
- quantity debe ser número.
- unit debe ser una de: "bultos", "toneladas", "cargas", "kg".
- pickupDate debe estar en formato YYYY-MM-DD si se puede inferir; si no, null.

Campos requeridos: product, quantity, municipio.
`

function fallbackParse(text: string): ParsedOrder {
  const lower = text.toLowerCase()
  const qtyMatch = lower.match(/(\d+(?:[.,]\d+)?)/)
  const quantity = qtyMatch ? Number(qtyMatch[1].replace(',', '.')) : null
  const unitMatch = lower.match(/\b(bultos?|toneladas?|cargas?|kg|kilos?)\b/)
  const unitRaw = unitMatch?.[1] ?? null
  const unit = unitRaw
    ? unitRaw.startsWith('bulto')
      ? 'bultos'
      : unitRaw.startsWith('tonel')
        ? 'toneladas'
        : unitRaw.startsWith('carg')
          ? 'cargas'
          : unitRaw === 'kilos'
            ? 'kg'
            : unitRaw
    : null

  const municipioMatch = lower.match(/\ben\s+([a-záéíóúñ\s]+)$/i)
  const municipio = municipioMatch?.[1]?.trim() ?? null

  const productMatch = lower.match(/de\s+([a-záéíóúñ\s]+?)\s+(para|el|en)\b/)
  const product = productMatch?.[1]?.trim()
    ? productMatch[1].trim().replace(/^\w/, (c) => c.toUpperCase())
    : null

  const missing: string[] = []
  if (!product) missing.push('product')
  if (quantity === null || Number.isNaN(quantity)) missing.push('quantity')
  if (!municipio) missing.push('municipio')

  return {
    product,
    quantity: quantity === null || Number.isNaN(quantity) ? null : quantity,
    unit,
    pickupDate: null,
    municipio: municipio ? municipio.replace(/^\w/, (c) => c.toUpperCase()) : null,
    missing,
  }
}

function tryParseJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const slice = text.slice(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeCandidate(candidate: unknown): ParsedOrder {
  const rec = isRecord(candidate) ? candidate : null
  const product = typeof rec?.product === 'string' ? rec.product : null
  const quantity = typeof rec?.quantity === 'number' ? rec.quantity : null
  const unit = typeof rec?.unit === 'string' ? rec.unit : null
  const pickupDate = typeof rec?.pickupDate === 'string' ? rec.pickupDate : null
  const municipio = typeof rec?.municipio === 'string' ? rec.municipio : null

  const missing: string[] = Array.isArray(rec?.missing)
    ? (rec.missing as unknown[]).filter((x): x is string => typeof x === 'string')
    : []

  // recalcular missing mínimo
  if (!product && !missing.includes('product')) missing.push('product')
  if ((quantity === null || Number.isNaN(quantity)) && !missing.includes('quantity')) missing.push('quantity')
  if (!municipio && !missing.includes('municipio')) missing.push('municipio')

  return {
    product,
    quantity,
    unit,
    pickupDate,
    municipio,
    missing,
  }
}

export const handler: Schema['analyzeOrderFromText']['functionHandler'] = async (event) => {
  const text = String(event.arguments.text ?? '').trim()
  if (!text) {
    return {
      product: null,
      quantity: null,
      unit: null,
      pickupDate: null,
      municipio: null,
      missing: ['text'],
    }
  }

  // Si no hay credenciales o acceso a Bedrock, devolvemos fallback.
  const modelId = process.env.BEDROCK_MODEL_ID
  const bedrockRegion = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1'
  if (!modelId) return fallbackParse(text)

  try {
    const client = new BedrockRuntimeClient({ region: bedrockRegion })

    // Claude on Bedrock usa un formato específico; lo mantenemos simple y robusto.
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 300,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text }],
        },
      ],
    })

    const resp = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(body),
      })
    )

    const decoded = new TextDecoder().decode(resp.body)
    const payload: unknown = JSON.parse(decoded)

    // En Claude, el texto suele venir en payload.content[].text
    let outText = ''
    if (isRecord(payload)) {
      const content = payload.content
      if (Array.isArray(content)) {
        outText = content
          .map((c) => (isRecord(c) && typeof c.text === 'string' ? c.text : ''))
          .filter(Boolean)
          .join('\n')
      } else if (typeof payload.completion === 'string') {
        outText = payload.completion
      }
    }

    const candidate = tryParseJson(String(outText))
    if (!candidate) return fallbackParse(text)

    return normalizeCandidate(candidate)
  } catch {
    return fallbackParse(text)
  }
}
