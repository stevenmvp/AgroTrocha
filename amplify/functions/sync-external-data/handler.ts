import type { Schema } from '../../data/resource'

// Minimal, conflict-free handler for the sync function.
// Keeps authorization behavior and returns a clear placeholder.

export const handler: Schema['syncExternalApiNow']['functionHandler'] = async (event) => {
  const identity = (event as any).identity as { claims?: Record<string, unknown> } | undefined
  const groupsRaw = identity?.claims?.['cognito:groups']
  const groups = Array.isArray(groupsRaw)
    ? groupsRaw.map(String)
    : typeof groupsRaw === 'string'
    ? groupsRaw.split(',').map((s) => s.trim())
    : []

  if (!groups.includes('ADMIN') && !groups.includes('STAFF')) {
    throw new Error('Not authorized: requiere rol ADMIN/STAFF para ejecutar sync directo')
  }

  const apiId = String((event as any).arguments?.apiId ?? 'unknown')
  return { status: 'OK', message: `sync-external-data: noop for apiId=${apiId}` }
}
