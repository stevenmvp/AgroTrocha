import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

type IdentityLike = {
  sub?: string
  claims?: Record<string, unknown>
}

type AppSyncEventLike = {
  arguments?: Record<string, unknown>
  identity?: IdentityLike
  info?: { fieldName?: string }
}

/**
 * Extrae un claim string de identidad de usuario.
 */
function getStringClaim(identity: IdentityLike | undefined, key: string): string | null {
  const claims = identity?.claims
  if (!claims) return null
  const v = claims[key]
  return typeof v === 'string' && v.trim() ? v : null
}

/**
 * Extrae los grupos Cognito del usuario.
 */
function getGroups(identity: IdentityLike | undefined): string[] {
  const raw = identity?.claims?.['cognito:groups']
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string') as string[]
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((s) => s.trim())
  return []
}

/**
 * Verifica si el usuario es admin.
 */
function isAdmin(identity: IdentityLike | undefined): boolean {
  const groups = getGroups(identity)
  const customRole = getStringClaim(identity, 'custom:role')?.toUpperCase() ?? ''
  return groups.includes('ADMIN') || groups.includes('STAFF') || customRole === 'ADMIN'
}

/**
 * Handler para invocar Claude Haiku (u otro modelo) en Bedrock.
 *
 * Recibe:
 * - args.prompt: string (el mensaje del usuario)
 * - args.modelId (opcional): string (ej. ARN de inference-profile o modelo)
 *
 * Devuelve:
 * - { success: true, response: string }
 * - { success: false, error: string }
 *
 * Las variables de entorno esperadas:
 * - AI_MODEL: ARN del modelo principal (puede ser inference-profile)
 * - AI_MODEL_PRIMARY: ARN del modelo para operaciones normales
 * - AI_MODEL_FAST: ARN del modelo para respuestas rápidas
 * - AWS_REGION: región de AWS
 */
export async function handler(event: AppSyncEventLike) {
  try {
    // 1. Autenticación mínima
    const userId = event.identity?.sub
    if (!userId) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const args = event.arguments as Record<string, unknown> | undefined
    if (!args) {
      return { success: false, error: 'Argumentos requeridos' }
    }

    const prompt = args.prompt as string | undefined
    if (!prompt || typeof prompt !== 'string') {
      return { success: false, error: 'Campo "prompt" es requerido y debe ser string' }
    }

    // 2. Obtener configuración del modelo
    // Prioridad: modelId explícito > AI_MODEL_PRIMARY > AI_MODEL
    let modelId = args.modelId as string | undefined
    if (!modelId) {
      modelId = process.env.AI_MODEL_PRIMARY || process.env.AI_MODEL
    }
    if (!modelId) {
      return {
        success: false,
        error: 'AI_MODEL no configurada. Contacta al administrador.',
      }
    }

    console.log(`[ask-bedrock] Using model: ${modelId}`)
    console.log(`[ask-bedrock] Region: ${process.env.AWS_REGION}`)

    // 3. Crear cliente de Bedrock (la región debe ser la de tu stack)
    const bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    })

    // 4. Leer configuración de tokens y otras variables
    const maxTokens = parseInt(process.env.AI_MAX_TOKENS || '1024', 10)
    const enableWriteActions = process.env.AI_ENABLE_WRITE_ACTIONS === 'true'

    // 5. Preparar el payload para Anthropic (Claude)
    // https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html
    const payload = {
      anthropic_version: 'bedrock-2023-06-01',
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }

    // 6. Invocar el modelo
    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(payload),
      contentType: 'application/json',
      accept: 'application/json',
    })

    const response = await bedrockClient.send(command)

    // 7. Parsear la respuesta
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    // Claude devuelve { content: [{ type: 'text', text: '...' }] }
    let extractedText = ''
    if (responseBody.content && Array.isArray(responseBody.content)) {
      for (const block of responseBody.content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          extractedText += block.text
        }
      }
    }

    if (!extractedText) {
      return {
        success: false,
        error: 'No se recibió respuesta del modelo.',
      }
    }

    // Log de tokens usados (informativo)
    const inputTokens = responseBody.usage?.input_tokens ?? 0
    const outputTokens = responseBody.usage?.output_tokens ?? 0
    console.log(`[ask-bedrock] Tokens - Input: ${inputTokens}, Output: ${outputTokens}`)

    return {
      success: true,
      response: extractedText,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[ask-bedrock] Error:', msg)
    return {
      success: false,
      error: `Error al invocar el modelo: ${msg}`,
    }
  }
}
