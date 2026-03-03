# AgroTrocha

PWA offline-first de logística colaborativa rural (groupage) para pequeños productores.

## Quickstart (local)
- Instalar deps: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`

## PWA
- Manifest + Service Worker: configurados con `vite-plugin-pwa`.
- El SW se registra en `src/main.tsx`.

## Amplify Gen 2 (backend)
El backend se define en TypeScript en la carpeta `amplify/`.

Comandos:
- Sandbox: `npm run ampx:sandbox`
- Sincronizar outputs a `public/` (para que el frontend los cargue en runtime): `npm run sync:outputs`

Requisito: la app necesita `public/amplify_outputs.json` para iniciar con backend completo (Auth + Data + Functions).

Si se cae la red, la app sigue funcionando con su enfoque offline-first y cola local, y reintenta sincronizar al volver online.

### Activar IA (Bedrock)
- Las funciones IA son `chat-ai` y `analyze-audio`.
- Variables por defecto en backend:
	- `BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0`
	- `BEDROCK_REGION=us-east-1`
- En tu cuenta AWS debes habilitar acceso al modelo en Bedrock (Model access) para la región configurada.

## Deploy en `main` (web + backend)
- `amplify.yml` ejecuta backend primero con:
	- `npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID`
- Luego construye frontend y sincroniza `amplify_outputs.json`.
- Si en CI no existe `amplify_outputs.json`, el build falla para evitar publicar una app sin backend.

## Roles / permisos
- Modelos sensibles: owner-based + lectura operativa por grupos Cognito `ADMIN` y `STAFF`.
- Catálogos (paises, impuestos, fletes, etc.): lectura para usuarios autenticados, escritura solo `ADMIN/STAFF`.

## Docs
- Ver DOCS_ARCH.md, DOCS_DB_MODEL.md, DOCS_IA_PROMPTS.md, ROADMAP.md.

## Deploy (Amplify Hosting)
Incluye `amplify.yml` con build de Vite (`dist/`). Al conectar el repo en Amplify Console, debería detectar el pipeline automáticamente.
