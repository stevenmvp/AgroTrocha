# AgroTrocha — Roadmap

## Fase 0 — Bootstrap (hoy)
- Vite + React + TypeScript + Tailwind
- PWA base (manifest + service worker)
- Documentación técnica inicial

## Fase 1 — MVP (2–4 semanas)
- Auth (Cognito): registro/login
- Perfil: role (PRODUCTOR/TRANSPORTISTA) + municipio
- Registro de carga (texto simula voz)
- Lambda IA: extracción de entidades (Bedrock) + fallback local
- Data: Orders + consulta transportista por municipio
- Offline: cola local y sync al reconectar

## Fase 2 — Consolidación (4–8 semanas)
- Trips (publicación de cupo/camión)
- Matching automático municipio+fecha (y ranking)
- Notificaciones (in-app)

## Fase 3 — Audio end-to-end (8–12 semanas)
- Subida de audio a S3
- Transcripción (p.ej. Amazon Transcribe) y análisis IA
- Mejoras NLP para variaciones regionales

## Fase 4 — Transparencia de precios (12+ semanas)
- Integración de precios mayoristas
- Dashboards por producto/municipio

## Fase 5 — Escala nacional
- Multi-región, optimización de costos
- Observabilidad y alertas
- Gobierno de datos y analítica avanzada
