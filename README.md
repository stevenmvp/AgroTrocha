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

Nota: la app intenta cargar `public/amplify_outputs.json` en runtime. Si no existe, corre en “modo local” (sin Auth).

## Roles / permisos
- Modelos sensibles: owner-based + lectura operativa por grupos Cognito `ADMIN` y `STAFF`.
- Catálogos (paises, impuestos, fletes, etc.): lectura para usuarios autenticados, escritura solo `ADMIN/STAFF`.

## Docs
- Ver DOCS_ARCH.md, DOCS_DB_MODEL.md, DOCS_IA_PROMPTS.md, ROADMAP.md.

## Deploy (Amplify Hosting)
Incluye `amplify.yml` con build de Vite (`dist/`). Al conectar el repo en Amplify Console, debería detectar el pipeline automáticamente.
