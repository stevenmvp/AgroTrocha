# AgroTrocha — Modelo NoSQL (DynamoDB)

Este documento describe el diccionario de datos para Amplify Data (Gen 2), que genera tablas DynamoDB por modelo.

## Entidades

## Roles y permisos (resumen)
- **Owner-based**: el usuario autenticado gestiona sus propios registros.
- **Admin/Staff**: usuarios en grupos Cognito `ADMIN` o `STAFF` administran catálogos y operación.
- **Transportista por municipio**: recomendado vía Query custom + Lambda (server-side) leyendo claims (fase siguiente).

### User
Representa el perfil de una persona autenticada.

Campos:
- `id` (ID, PK)
- `name` (string)
- `role` (enum): `PRODUCTOR` | `TRANSPORTISTA` | `ADMIN` | `OPERADOR`
- `countryCode` (string)
- `municipio` (string)
- `vereda` (string)
- `phone` (string)

Relaciones:
- 1 User → N Orders (por `userId`)

Acceso:
- Owner-only (cada usuario ve y edita su perfil)
- Admin/Staff: lectura operativa

---

### Order
Pedido/carga registrada por un productor.

Campos:
- `id` (ID, PK)
- `userId` (ID, FK a User)
- `product` (string, required)
- `quantity` (float, required)
- `unit` (string): bultos/toneladas/cargas
- `pickupDate` (date)
- `municipio` (string, required)
- `status` (enum): `PENDIENTE` | `CONSOLIDADO` | `TRANSITO` | `ENTREGADO`
- `aiAnalysis` (string): JSON/texto de la extracción
- `tripId` (ID, optional)

Relaciones:
- N Orders → 1 Trip

Índices sugeridos (para matching):
- GSI por `municipio` + `pickupDate` (para listar pedidos candidatos)

Acceso:
- Productor (owner): CRUD de sus órdenes
- Transportista: acceso recomendado por query custom (server-side) restringida por municipio
- Admin/Staff: lectura operativa global

---

### Trip
Viaje publicado por un transportista.

Campos:
- `id` (ID, PK)
- `driverId` (ID)
- `vehicleType` (string)
- `capacityKg` (int)
- `currentLoadKg` (int)
- `status` (enum): `PROGRAMADO` | `EN_CARGA` | `VIAJANDO` | `FINALIZADO`

Relaciones:
- 1 Trip → N Orders

Acceso:
- Transportista (grupo/rol): CRUD de sus trips (fase 2)

---

## Catálogos y operación (Admin/Staff)

### Municipality
Catálogo de municipios para normalizar matching, fletes y perfiles.

Acceso:
- Authenticated: read
- Admin/Staff: CRUD

### Product
Catálogo de productos (opcional, pero recomendado para estandarizar nombres/unidades).

Acceso:
- Authenticated: read
- Admin/Staff: CRUD

### Country
Catálogo de países.

Acceso:
- Authenticated: read
- Admin/Staff: CRUD

### TaxCategory / TaxRate
Catálogo de impuestos y tasas vigentes.

Acceso:
- Authenticated: read
- Admin/Staff: CRUD

### Provider
Listado de proveedores (transportistas, compradores, insumos, etc.).

Acceso:
- Authenticated: read
- Admin/Staff: CRUD

### FreightRate
Tarifas de flete por ruta (origen/destino) y tipo de vehículo.

Acceso:
- Authenticated: read
- Admin/Staff: CRUD

### Request
Tabla de peticiones/pendientes para flujos administrativos (cambio de rol, alta de proveedor, soporte, corrección de datos).

Acceso:
- Owner: gestiona su request
- Admin/Staff: CRUD

### ExternalApi / ExternalSyncJob / PriceReference
Modelos para configurar integraciones y registrar sincronizaciones (y precios de referencia).

Notas:
- No almacenar secretos en Data; usar `secretName` como referencia.

## Patrones de acceso (MVP)
- Productor:
  - Crear Order
  - Listar mis Orders
- Transportista:
  - Listar Orders por municipio (+ fecha opcional)
  - Ver agregado por producto/cantidad para consolidación

## Notas
- El enforcement de “solo mi municipio” se implementa en una Query custom resuelta por Lambda.
- En fases posteriores se recomienda capturar coordenadas (lat/lng) y usar geohash para matching por radio.
