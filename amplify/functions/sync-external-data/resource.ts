import { defineFunction } from '@aws-amplify/backend'

export const syncExternalData = defineFunction({
  name: 'sync-external-data',
  entry: './handler.ts',
})
