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
  return parseOrderLocally(text)
}
