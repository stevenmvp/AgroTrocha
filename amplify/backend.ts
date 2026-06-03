import { defineBackend } from '@aws-amplify/backend'
import type { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { secureOrders } from './functions/secure-orders/resource'
import { syncExternalData } from './functions/sync-external-data/resource'

const backend = defineBackend({
  auth,
  data,
  secureOrders,
  syncExternalData,
})

// Permisos/env para enforcement server-side por municipio + CRUD seguro.
const secureOrdersLambda = backend.secureOrders.resources.lambda as unknown as LambdaFunction

secureOrdersLambda.addEnvironment(
  'ORDER_TABLE',
  backend.data.resources.tables['Order'].tableName
)
secureOrdersLambda.addEnvironment(
  'ORDER_PUBLIC_TABLE',
  backend.data.resources.tables['OrderPublic'].tableName
)
secureOrdersLambda.addEnvironment(
  'USER_TABLE',
  backend.data.resources.tables['User'].tableName
)
secureOrdersLambda.addEnvironment(
  'REQUEST_TABLE',
  backend.data.resources.tables['Request'].tableName
)
secureOrdersLambda.addEnvironment(
  'SEQUENCE_TABLE',
  backend.data.resources.tables['Sequence'].tableName
)

backend.data.resources.tables['Order'].grantReadWriteData(secureOrdersLambda)
backend.data.resources.tables['OrderPublic'].grantReadWriteData(secureOrdersLambda)
backend.data.resources.tables['User'].grantReadData(secureOrdersLambda)
backend.data.resources.tables['Request'].grantReadWriteData(secureOrdersLambda)
backend.data.resources.tables['Sequence'].grantReadWriteData(secureOrdersLambda)

// Permisos/env para sincronización de datos externos (precios de mercado).
const syncExternalDataLambda = backend.syncExternalData.resources.lambda as unknown as LambdaFunction

syncExternalDataLambda.addEnvironment(
  'EXTERNAL_API_TABLE',
  backend.data.resources.tables['ExternalApi'].tableName
)
syncExternalDataLambda.addEnvironment(
  'EXTERNAL_SYNC_JOB_TABLE',
  backend.data.resources.tables['ExternalSyncJob'].tableName
)
syncExternalDataLambda.addEnvironment(
  'PRICE_REFERENCE_TABLE',
  backend.data.resources.tables['PriceReference'].tableName
)

<<<<<<< HEAD
backend.data.resources.tables['ExternalApi'].grantReadData(syncExternalDataLambda)
backend.data.resources.tables['ExternalSyncJob'].grantReadWriteData(syncExternalDataLambda)
backend.data.resources.tables['PriceReference'].grantReadWriteData(syncExternalDataLambda)
=======
chatLambda.addToRolePolicy(bedrockInvokePolicy)
analyzeAudioLambda.addToRolePolicy(bedrockInvokePolicy)

// Permisos/env para sincronización de APIs externas (SIPSA, etc.).
const syncExternalLambda = backend.syncExternalData.resources.lambda as unknown as LambdaFunction

syncExternalLambda.addEnvironment('EXTERNAL_API_TABLE', backend.data.resources.tables['ExternalApi'].tableName)
syncExternalLambda.addEnvironment('EXTERNAL_SYNC_JOB_TABLE', backend.data.resources.tables['ExternalSyncJob'].tableName)
syncExternalLambda.addEnvironment('PRICE_REFERENCE_TABLE', backend.data.resources.tables['PriceReference'].tableName)

backend.data.resources.tables['ExternalApi'].grantReadData(syncExternalLambda)
backend.data.resources.tables['ExternalSyncJob'].grantReadWriteData(syncExternalLambda)
backend.data.resources.tables['PriceReference'].grantReadWriteData(syncExternalLambda)
>>>>>>> d468b75 (fix: assign syncExternalData function to data stack and resolve Amplify circular dependency)
