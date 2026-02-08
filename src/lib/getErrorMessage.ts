export function getErrorMessage(error: unknown): string {
  if (!error) return 'Error desconocido.'

  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message || 'Error.'

  // Amplify / GraphQL often throws objects like { errors: [{ message }] }
  if (typeof error === 'object') {
    const anyErr = error as Record<string, unknown>

    const directMessage = anyErr.message
    if (typeof directMessage === 'string' && directMessage.trim()) return directMessage

    const errors = anyErr.errors
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0] as unknown
      if (first && typeof first === 'object') {
        const msg = (first as Record<string, unknown>).message
        if (typeof msg === 'string' && msg.trim()) return msg
      }
    }

    const name = anyErr.name
    if (typeof name === 'string' && name.trim()) return name
  }

  try {
    return JSON.stringify(error)
  } catch {
    return 'Error desconocido.'
  }
}
