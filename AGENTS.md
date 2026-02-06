# AgroTrocha — Guía de Agentes (Trabajo Autónomo)

Este archivo define cómo dividir el trabajo en “sub-agentes” (humanos o IA) sin romper la arquitectura.

## Regla de oro
- Todo el código en TypeScript.
- Offline-first: si falla red, se guarda en local y se reintenta.
- Seguridad: permisos siempre server-side cuando sea posible.

## Sub-agente A — Amplify Architect
**Objetivo:** Backend Gen 2 listo para Auth + Data + Functions.

Checklist:
- [ ] `amplify/auth/resource.ts`: login por email y, en fase 2, atributos custom (`role`, `municipio`).
- [ ] `amplify/data/resource.ts`: modelos `User`, `Order`, `Trip` + queries/mutations custom.
- [ ] `amplify/functions/analyze-audio/`: Lambda para Bedrock (Claude Haiku) + fallback.
- [ ] Scripts: `npm run ampx:sandbox` + `npm run sync:outputs`.

Definición clave:
- Transportista debe ver órdenes de su municipio: idealmente con **query custom** que lea `custom:municipio` desde claims.

## Sub-agente B — PWA Specialist
**Objetivo:** PWA táctil, rápida y usable en campo.

Checklist:
- [ ] Manifest (nombre, íconos, theme color) y SW con estrategia offline.
- [ ] Indicador de conectividad y cola offline (pendientes).
- [ ] Experiencia installable (standalone) y caching seguro.

Archivo clave:
- `vite.config.ts` (PWA/Workbox)

## Sub-agente C — Logic Engine
**Objetivo:** Motor de consolidación (matching/groupage).

MVP:
- Matching por `municipio` + `pickupDate` (+ heurística de capacidad).

Fase siguiente:
- Matching por geocoordenadas (geohash/radio) + ranking por costo/tiempo.

Entregables:
- Query `suggestConsolidations` (custom business logic)
- Ranking + explicación (por qué sugirió ese match)

## Contratos (interfaces)
- IA debe retornar JSON con: `product`, `quantity`, `unit`, `pickupDate`, `municipio`, `missing[]`.
- El frontend nunca debe “inventar” datos: si falta, pedir confirmación.
