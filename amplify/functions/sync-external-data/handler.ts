import type { Schema } from '../../data/resource'

// Minimal, conflict-free handler for the sync function.
// Keeps authorization behavior and returns a clear placeholder.
// Phase 2: implement full SIPSA/external API sync with DynamoDB storage.

export const handler: Schema['syncExternalApiNow']['functionHandler'] = async (event) => {
  const ev = event as unknown as Record<string, unknown> | null
  const identity = (ev?.identity as Record<string, unknown> | undefined) ?? undefined
  const claims = (identity?.claims as Record<string, unknown> | undefined) ?? undefined
  const groupsRaw = claims?.['cognito:groups'] as unknown

  const groups = Array.isArray(groupsRaw)
    ? groupsRaw.map((g) => String(g))
    : typeof groupsRaw === 'string'
      ? groupsRaw.split(',').map((s) => s.trim())
      : []

  if (!groups.includes('ADMIN') && !groups.includes('STAFF')) {
    throw new Error('Not authorized: requiere rol ADMIN/STAFF para ejecutar sync directo')
  }

  const args = (ev?.arguments as Record<string, unknown> | undefined) ?? undefined
  const apiId = String(args?.apiId ?? 'unknown')
  return `sync-external-data: noop for apiId=${apiId}`
}
