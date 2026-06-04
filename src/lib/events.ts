type Handler = (...args: any[]) => void
const map = new Map<string, Set<Handler>>()

export function on(event: string, handler: Handler) {
  const s = map.get(event) ?? new Set()
  s.add(handler)
  map.set(event, s)
  return () => off(event, handler)
}

export function off(event: string, handler: Handler) {
  const s = map.get(event)
  if (!s) return
  s.delete(handler)
  if (s.size === 0) map.delete(event)
}

export function emit(event: string, ...args: any[]) {
  const s = map.get(event)
  if (!s) return
  for (const h of Array.from(s)) {
    try {
      h(...args)
    } catch {
      // ignore
    }
  }
}

export default { on, off, emit }
