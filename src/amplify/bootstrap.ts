import { Amplify } from 'aws-amplify'

export async function configureAmplifyFromPublicOutputs(): Promise<boolean> {
  try {
    const resp = await fetch('/amplify_outputs.json', { cache: 'no-store' })
    if (!resp.ok) return false
    const outputs = (await resp.json()) as Record<string, unknown>
    Amplify.configure(outputs)
    return true
  } catch {
    return false
  }
}
