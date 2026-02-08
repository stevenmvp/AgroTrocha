import { defineFunction } from '@aws-amplify/backend'

export const secureOrders = defineFunction({
  name: 'secure-orders',
  resourceGroupName: 'data',
  entry: './handler.ts',
})
