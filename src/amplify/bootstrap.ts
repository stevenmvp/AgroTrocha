import { Amplify } from 'aws-amplify'

export type AmplifyBootstrapResult = {
  ok: boolean
  error: string | null
}

export async function configureAmplifyFromPublicOutputs(): Promise<AmplifyBootstrapResult> {
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
        return { ok: true, error: null }
      } catch (e) {
        lastError = e
      }
    }

    if (lastError) {
      const message = lastError instanceof Error ? lastError.message : 'No pude cargar amplify_outputs.json.'
      console.warn('[amplify] No pude cargar outputs:', lastError)
      return { ok: false, error: message }
    }
    return { ok: false, error: 'No encontré amplify_outputs.json válido.' }
  } catch (e) {
    console.warn('[amplify] Error inesperado configurando Amplify:', e)
    const message = e instanceof Error ? e.message : 'Error inesperado al configurar Amplify.'
    return { ok: false, error: message }
  }
}
