import { defineFunction } from '@aws-amplify/backend'

export const analyzeAudio = defineFunction({
  name: 'analyze-audio',
  entry: './handler.ts',
  environment: {
    // Bedrock model id (puede ajustarse en sandbox/console)
    BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
  },
})
