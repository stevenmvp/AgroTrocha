import { defineBackend } from '@aws-amplify/backend'
import type { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { analyzeAudio } from './functions/analyze-audio/resource'
import { chatAI } from './functions/chat-ai/resource'
import { secureOrders } from './functions/secure-orders/resource'
import { syncExternalData } from './functions/sync-external-data/resource'

const backend = defineBackend({
  auth,
  data,
  analyzeAudio,
  chatAI,
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

// Permisos Bedrock (InvokeModel) para IA.
const chatLambda = backend.chatAI.resources.lambda as unknown as LambdaFunction
const analyzeAudioLambda = backend.analyzeAudio.resources.lambda as unknown as LambdaFunction

const bedrockInvokePolicy = new PolicyStatement({
  actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
  resources: ['*'],
})

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
