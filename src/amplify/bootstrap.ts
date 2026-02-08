import { Amplify } from 'aws-amplify'

export async function configureAmplifyFromPublicOutputs(): Promise<boolean> {
  try {
    const candidates = [
      `${import.meta.env.BASE_URL ?? '/'}amplify_outputs.json`,
      './amplify_outputs.json',
      '/amplify_outputs.json',
    ]

    let lastError: unknown = null
    for (const url of candidates) {
      try {
        const resp = await fetch(url, { cache: 'no-store' })
        if (!resp.ok) continue

        const contentType = resp.headers.get('content-type') ?? ''
        // If hosting rewrites missing files to index.html, this will be text/html.
        if (!contentType.toLowerCase().includes('application/json')) {
          const text = await resp.text()
          lastError = new Error(
            `amplify_outputs.json no es JSON (content-type: ${contentType || 'unknown'}). Recibido: ${text.slice(0, 60)}…`,
          )
          continue
        }

        const outputs = (await resp.json()) as Record<string, unknown>
        Amplify.configure(outputs)
        return true
      } catch (e) {
        lastError = e
      }
    }

    if (lastError) console.warn('[amplify] No pude cargar outputs:', lastError)
    return false
  } catch (e) {
    console.warn('[amplify] Error inesperado configurando Amplify:', e)
    return false
  }
}
