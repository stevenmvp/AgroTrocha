import type { Schema } from '../../data/resource'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const SYSTEM_PROMPT = `Eres AgroTrocha IA.
Ayudas a usuarios rurales (productores/transportistas) a operar la app y resolver dudas.

Reglas:
- Responde en español, claro y corto.
- Si faltan datos para una acción (crear pendiente/solicitud), pregunta por el dato faltante.
- No inventes datos personales.
`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractTextFromBedrockPayload(payload: unknown): string {
  if (!isRecord(payload)) return ''

  const content = payload.content
  if (Array.isArray(content)) {
    return content
      .map((c) => (isRecord(c) && typeof c.text === 'string' ? c.text : ''))
      .filter(Boolean)
      .join('\n')
  }

  if (typeof payload.completion === 'string') return payload.completion
  return ''
}

export const handler: Schema['askAI']['functionHandler'] = async (event) => {
  const text = String(event.arguments.text ?? '').trim()
  if (!text) return 'Escribe tu pregunta para poder ayudarte.'

  const modelId = process.env.BEDROCK_MODEL_ID
  if (!modelId) {
    return 'IA no configurada. Puedes usar Pendientes y Perfil en modo local.'
  }

  try {
    const client = new BedrockRuntimeClient({})

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 350,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text }],
        },
      ],
    })

    const resp = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(body),
      })
    )

    const decoded = new TextDecoder().decode(resp.body)
    const payload: unknown = JSON.parse(decoded)
    const out = extractTextFromBedrockPayload(payload)
    return out || 'No pude generar una respuesta.'
  } catch {
    return 'No pude consultar la IA en este momento. Intenta de nuevo.'
  }
}
