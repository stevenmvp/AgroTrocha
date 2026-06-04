import { defineFunction } from '@aws-amplify/backend'

export const askBedrock = defineFunction({
  name: 'ask-bedrock',
  resourceGroupName: 'data',
  entry: './handler.ts',
})
