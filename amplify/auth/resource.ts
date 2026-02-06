import { defineAuth } from '@aws-amplify/backend'

/**
 * Auth (Cognito)
 * - MVP: login por email/password
 * - Fase siguiente: OTP y atributos custom (role/municipio)
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
})
