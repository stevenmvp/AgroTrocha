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

### Sincronización de precios (SISPA)
- El flujo de precios usa la mutación `syncExternalApiNow`.
- La API de referencia para semilla es `SISPA Precios Alimentos` en `public/seed-data/ExternalApi.json`.
- La Lambda `sync-external-data` normaliza payloads heterogéneos y, si la fuente falla, crea datos fallback para no dejar la tabla vacía.

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

## Sonidos en terminal (exito/error)
- Activar en la sesion actual:
	- `source scripts/terminal-sounds.sh`
- Para dejarlo permanente en bash, agrega en `~/.bashrc`:
	- `source /workspaces/AgroTrocha/scripts/terminal-sounds.sh`
- Sonidos:
	- `1` beep cuando el comando termina bien.
	- `2` beeps cuando termina con error.

Si usas VS Code y no escuchas nada, habilita la campana del terminal:
- Ajuste `Terminal > Integrated: Enable Bell` (`terminal.integrated.enableBell = true`).
