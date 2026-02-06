import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const src = path.join(root, 'amplify_outputs.json')
const destDir = path.join(root, 'public')
const dest = path.join(destDir, 'amplify_outputs.json')

if (!fs.existsSync(src)) {
  console.log('[sync:outputs] amplify_outputs.json no existe (ok).')
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
console.log('[sync:outputs] Copiado amplify_outputs.json -> public/amplify_outputs.json')
