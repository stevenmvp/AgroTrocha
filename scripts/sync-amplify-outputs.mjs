import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const src = path.join(root, 'amplify_outputs.json')
const destDir = path.join(root, 'public')
const dest = path.join(destDir, 'amplify_outputs.json')

if (!fs.existsSync(src)) {
  const isCi = process.env.CI === 'true' || Boolean(process.env.AWS_BRANCH)
  if (isCi) {
    console.error('[sync:outputs] ERROR: amplify_outputs.json no existe en CI. Ejecuta pipeline-deploy antes del build frontend.')
    process.exit(1)
  }
  console.log('[sync:outputs] amplify_outputs.json no existe en local. Ejecuta `npm run ampx:sandbox` y luego `npm run sync:outputs`.')
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
console.log('[sync:outputs] Copiado amplify_outputs.json -> public/amplify_outputs.json')
