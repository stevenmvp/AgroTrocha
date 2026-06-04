import { defineBackend } from '@aws-amplify/backend'
import { Stack } from 'aws-cdk-lib'
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
 * Agregar permisos IAM para que la función askBedrock pueda invocar Bedrock.
 * Accedemos al stack CDK subyacente de Amplify para modificar los permisos.
 */
const stack = Stack.of(backend)

// Obtener el rol de la función askBedrock del data backend
const dataBackend = backend.data
if (dataBackend && 'resources' in dataBackend) {
  const lambdaFunction = (dataBackend.resources as any)?.functions?.askBedrock
  if (lambdaFunction && lambdaFunction.role) {
    lambdaFunction.role.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [
          'arn:aws:bedrock:*::foundation-model/*',
          'arn:aws:bedrock:*::inference-profile/*',
        ],
      })
    )
  }
}

export default backend
export { secureOrders, syncExternalData, askBedrock }
