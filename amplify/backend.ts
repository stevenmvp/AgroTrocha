import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { analyzeAudio } from './functions/analyze-audio/resource'
import { syncExternalData } from './functions/sync-external-data/resource'

defineBackend({
  auth,
  data,
  analyzeAudio,
  syncExternalData,
})
