import type { Schema } from '../../data/resource'

/**
 * MVP placeholder:
 * - En fase siguiente: invocar APIs externas (precios/clima/etc.), normalizar, y escribir en PriceReference.
 */
export const handler: Schema['syncExternalApiNow']['functionHandler'] = async (event) => {
  const apiId = String(event.arguments.apiId)
  return `Sync requested for apiId=${apiId}`
}
