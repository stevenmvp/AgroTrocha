import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'

export type ParsedOrder = {
  product: string
  quantity: number
  unit?: string
  pickupDate?: string
  municipio: string
}

function parseOrderLocally(input: string): ParsedOrder | null {
  const lower = input.toLowerCase()
  const qtyMatch = lower.match(/(\d+(?:[.,]\d+)?)/)
  const quantity = qtyMatch ? Number(qtyMatch[1].replace(',', '.')) : NaN
  const unitMatch = lower.match(/\b(bultos?|toneladas?|cargas?|kg|kilos?)\b/)
  const unit = unitMatch?.[1]
  const municipioMatch = lower.match(/\ben\s+([a-záéíóúñ\s]+)$/i)
  const municipio = municipioMatch?.[1]?.trim()

  const productMatch = lower.match(/de\s+([a-záéíóúñ\s]+?)\s+(para|el|en)\b/)
  const product = productMatch?.[1]?.trim()

  if (!product || !municipio || !Number.isFinite(quantity)) return null
  return {
    product: product.replace(/^\w/, (c) => c.toUpperCase()),
    quantity,
    unit,
    municipio: municipio.replace(/^\w/, (c) => c.toUpperCase()),
  }
}

export async function analyzeTextWithAI(text: string): Promise<ParsedOrder | null> {
  try {
    const client = generateClient<Schema>()
    const resp = await client.queries.analyzeOrderFromText({ text })
    const data = resp.data
    if (!data || (Array.isArray(data.missing) && data.missing.length > 0)) {
      return parseOrderLocally(text)
    }
    if (!data.product || !data.quantity || !data.municipio) return parseOrderLocally(text)
    return {
      product: data.product,
      quantity: data.quantity,
      unit: data.unit ?? undefined,
      pickupDate: data.pickupDate ?? undefined,
      municipio: data.municipio,
    }
  } catch {
    return parseOrderLocally(text)
  }
}
