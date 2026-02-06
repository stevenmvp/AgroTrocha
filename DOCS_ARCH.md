# AgroTrocha — Arquitectura (Gen 2)

## Objetivo
AgroTrocha es una PWA mobile-first y offline-first para logística colaborativa (groupage) orientada al pequeño productor. El producto reduce costos y fricción consolidando cargas y aportando transparencia de precios.

## Stack (mandatorio)
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: AWS Amplify Gen 2 (IaC)
- Data: Amplify Data (AppSync + DynamoDB)
- Auth: Amazon Cognito (Amplify Auth)
- Functions: AWS Lambda (Amplify Functions)
- IA: Amazon Bedrock (Claude 3 Haiku) para extracción de entidades
- Storage: Amazon S3 para audios

## Flujo de datos (MVP)
1. Productor registra una carga (texto simula voz) en la PWA.
2. La PWA llama a una Query de Amplify Data (custom business logic) que enruta a Lambda `analyze-audio`.
3. La Lambda llama Bedrock para extraer JSON (producto, cantidad, unidad, fecha, municipio).
4. La PWA crea un `Order` (modelo DynamoDB vía Amplify Data) y lo asocia al usuario.
5. Transportista consulta oportunidades de consolidación por municipio/fecha (query dedicada).

## Offline-first
- La PWA mantiene una cola local (LocalStorage/IndexedDB) para “cargas pendientes”.
- Si no hay conectividad, se guarda localmente y se reintenta al reconectar.
- El Service Worker (PWA) cachea assets estáticos y soporta navegación offline.

## Seguridad y autorización
- Productor: CRUD de sus `Order` (owner-based).
- Transportista: lectura limitada a su municipio mediante una Query custom con Lambda (enforced server-side).
- Perfiles: `role` y `municipio` se capturan como atributos de usuario (Cognito) y/o registro en modelo `User`.

Recomendación de niveles:
- **ADMIN/STAFF** como grupos Cognito (control real server-side).
- `role` en modelo `User` se usa para UX y flujos, pero el enforcement debe ser por reglas de Data y/o Lambda.

## Componentes backend (Amplify Gen 2)
- amplify/auth/resource.ts: configuración Cognito (login por email)
- amplify/data/resource.ts: modelos (User, Order, Trip) + queries custom (matching / IA)
- amplify/functions/analyze-audio/: Lambda que invoca Bedrock

Integraciones externas:
- `ExternalApi`, `ExternalSyncJob`, `PriceReference` (catálogo + logs + datos)
- Mutación admin `syncExternalApiNow` (manual) para disparar un sync (placeholder en MVP)

## Observabilidad
- Logs: CloudWatch (Lambda) + streaming en sandbox (`npx ampx sandbox`)
- Métricas: conteos de órdenes/municipios y latencia de análisis IA (fase posterior)
