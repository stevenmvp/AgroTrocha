import { defineBackend } from '@aws-amplify/backend'
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam'
import { auth } from './auth/resource'
import { data } from './data/resource'
// Importar funciones para asegurarse de que se incluyen en la compilación
import { secureOrders } from './functions/secure-orders/resource'
import { syncExternalData } from './functions/sync-external-data/resource'
import { askBedrock } from './functions/ask-bedrock/resource'

const backend = defineBackend({
  auth,
  data,
})

/**
 * Permisos IAM para que la función askBedrock pueda invocar modelos en Bedrock.
 * Esto es crítico para que el backend pueda comunicarse con AWS Bedrock.
 */
const bedrockPolicy = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'bedrock:InvokeModel',
    'bedrock:InvokeModelWithResponseStream',
  ],
  // Permite acceso a todos los modelos de Bedrock en cualquier región
  resources: ['arn:aws:bedrock:*::foundation-model/*', 'arn:aws:bedrock:*::inference-profile/*'],
})

// Agregar el policy a la función Lambda askBedrock
backend.data.resources.lambda?.askBedrock?.role?.addToPrincipalPolicy(bedrockPolicy)

export default backend
export { secureOrders, syncExternalData, askBedrock }
