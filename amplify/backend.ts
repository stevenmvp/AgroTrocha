import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
// Importar funciones para asegurarse de que se incluyen en la compilación
import { secureOrders } from './functions/secure-orders/resource'
import { syncExternalData } from './functions/sync-external-data/resource'

const backend = defineBackend({
  auth,
  data,
})

export default backend
export { secureOrders, syncExternalData }
