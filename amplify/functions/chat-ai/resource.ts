import { defineFunction } from '@aws-amplify/backend'

export const chatAI = defineFunction({
  name: 'chat-ai',
  entry: './handler.ts',
  environment: {
    // Bedrock model id + región (ajustable por entorno)
    BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
    BEDROCK_REGION: 'us-east-1',
  },
})
