import { a, defineData, type ClientSchema } from '@aws-amplify/backend'
import { secureOrders } from '../functions/secure-orders/resource'
import { syncExternalData } from '../functions/sync-external-data/resource'

const ADMIN_GROUPS = ['ADMIN', 'STAFF']

const schema = a.schema({
  /**
   * Secuencias para numeración trazable (no reemplaza el id UUID).
   * Ej: ORDER => 1,2,3...; REQUEST => 1,2,3...
   */
  Sequence: a
    .model({
      id: a.id(),
      value: a.integer(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.groups(ADMIN_GROUPS)]),
  /**
   * Perfil de usuario (no confundir con Cognito User).
   * Regla: el control fuerte de permisos se hace por grupos Cognito (ADMIN/STAFF)
   * y por owner (usuario sobre sus datos).
   */
  User: a
    .model({
      id: a.id(),
      name: a.string(),
      role: a.enum(['PRODUCTOR', 'TRANSPORTISTA', 'ADMIN', 'OPERADOR']),
      countryCode: a.string(),
      municipio: a.string(),
      vereda: a.string(),
      phone: a.string(),
      orders: a.hasMany('Order', 'userId'),
      trips: a.hasMany('Trip', 'driverId'),
      requests: a.hasMany('Request', 'createdByUserId'),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.groups(ADMIN_GROUPS).to(['read']),
    ]),

  /**
   * Perfil público (mínimo) para que otros usuarios vean quién subió un pendiente.
   * Nota: algunos campos de contacto pueden ser necesarios para coordinar (ej. teléfono).
   */
  UserPublic: a
    .model({
      id: a.id(),
      displayName: a.string().required(),
      role: a.enum(['PRODUCTOR', 'TRANSPORTISTA', 'ADMIN', 'OPERADOR']),
      municipio: a.string(),
      vereda: a.string(),
      phone: a.string(),
      updatedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [index('municipio').queryField('listPublicUsersByMunicipio')])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner(),
      allow.groups(ADMIN_GROUPS).to(['read']),
    ]),

  /**
   * Tablas de referencia (catálogos) — administradas por ADMIN/STAFF.
   * - Cualquier usuario autenticado puede leer.
   */
  Country: a
    .model({
      code: a.string().required(),
      name: a.string().required(),
      currencyCode: a.string(),
      active: a.boolean(),
    })
    .secondaryIndexes((index) => [index('code').queryField('getCountryByCode')])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(ADMIN_GROUPS),
    ]),

  Municipality: a
    .model({
      countryCode: a.string().required(),
      department: a.string(),
      name: a.string().required(),
      daneCode: a.string(),
      active: a.boolean(),
    })
    .secondaryIndexes((index) => [
      index('countryCode').sortKeys(['department', 'name']).queryField('listMunicipalitiesByCountry'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(ADMIN_GROUPS),
    ]),

  Product: a
    .model({
      name: a.string().required(),
      category: a.string(),
      defaultUnit: a.enum(['bultos', 'toneladas', 'cargas', 'kg', 'unidades']),
      active: a.boolean(),
    })
    .secondaryIndexes((index) => [index('name').queryField('listProductsByName')])
    .authorization((allow) => [
      // MVP: permitir a cualquier usuario autenticado crear productos.
      // Mantiene UPDATE/DELETE en ADMIN/STAFF.
      allow.authenticated().to(['read', 'create']),
      allow.groups(ADMIN_GROUPS),
    ]),

  TaxCategory: a
    .model({
      countryCode: a.string().required(),
      name: a.string().required(),
      type: a.enum(['IVA', 'RETENCION', 'ICA', 'ARANCEL', 'OTRO']),
      active: a.boolean(),
      rates: a.hasMany('TaxRate', 'categoryId'),
    })
    .secondaryIndexes((index) => [
      index('countryCode').sortKeys(['type']).queryField('listTaxCategoriesByCountry'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(ADMIN_GROUPS),
    ]),

  TaxRate: a
    .model({
      categoryId: a.id().required(),
      category: a.belongsTo('TaxCategory', 'categoryId'),
      region: a.string(),
      rate: a.float().required(),
      effectiveFrom: a.date(),
      effectiveTo: a.date(),
      notes: a.string(),
    })
    .secondaryIndexes((index) => [
      index('categoryId').sortKeys(['effectiveFrom']).queryField('listTaxRatesByCategory'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(ADMIN_GROUPS),
    ]),

  Provider: a
    .model({
      name: a.string().required(),
      providerType: a.enum(['TRANSPORTE', 'COMPRADOR', 'INSUMOS', 'OTRO']),
      countryCode: a.string(),
      municipio: a.string(),
      contactName: a.string(),
      phone: a.string(),
      email: a.email(),
      active: a.boolean(),
      freightRates: a.hasMany('FreightRate', 'providerId'),
    })
    .secondaryIndexes((index) => [
      index('countryCode').sortKeys(['providerType']).queryField('listProvidersByCountry'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(ADMIN_GROUPS),
    ]),

  FreightRate: a
    .model({
      providerId: a.id().required(),
      provider: a.belongsTo('Provider', 'providerId'),
      originCountryCode: a.string().required(),
      originMunicipio: a.string().required(),
      destCountryCode: a.string().required(),
      destMunicipio: a.string().required(),
      vehicleType: a.enum(['TURBO', 'SENCILLO', 'DOBLETROQUE', 'OTRO']),
      pricingUnit: a.enum(['POR_VIAJE', 'POR_KG', 'POR_TON']),
      amount: a.float().required(),
      currencyCode: a.string(),
      effectiveFrom: a.date(),
      effectiveTo: a.date(),
      notes: a.string(),
    })
    .secondaryIndexes((index) => [
      index('originMunicipio')
        .sortKeys(['destMunicipio'])
        .queryField('listFreightRatesByOriginAndDest'),
      index('providerId').queryField('listFreightRatesByProvider'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(ADMIN_GROUPS),
    ]),

  Order: a
    .model({
      userId: a.id(),
      user: a.belongsTo('User', 'userId'),
      orderNumber: a.integer(),
      product: a.string().required(),
      quantity: a.float().required(),
      unit: a.string(),
      pickupDate: a.date(),
      municipio: a.string().required(),
      status: a.enum(['PENDIENTE', 'CONSOLIDADO', 'TRANSITO', 'ENTREGADO']),
      aiAnalysis: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      tripId: a.id(),
      trip: a.belongsTo('Trip', 'tripId'),
    })
    .secondaryIndexes((index) => [
      index('municipio').sortKeys(['pickupDate']).queryField('listOrdersByMunicipioAndPickupDate'),
      index('userId').queryField('listOrdersByUserId'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.groups(ADMIN_GROUPS).to(['read']),
    ]),

  /**
   * Pendiente público (subset) para operación: lista por municipio sin exponer análisis/privado.
   * Nota: aún no implementa un control estricto por municipio en server-side (fase 2 con claims).
   */
  OrderPublic: a
    .model({
      id: a.id(),
      orderId: a.id().required(),
      orderNumber: a.integer(),
      createdByUserId: a.id().required(),
      createdByName: a.string().required(),
      municipio: a.string().required(),
      pickupDate: a.date(),
      product: a.string().required(),
      quantity: a.float().required(),
      unit: a.string(),
      status: a.enum(['PENDIENTE', 'CONSOLIDADO', 'TRANSITO', 'ENTREGADO']),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('municipio').sortKeys(['pickupDate']).queryField('listPublicOrdersByMunicipioAndPickupDate'),
      index('createdByUserId').queryField('listPublicOrdersByCreator'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.groups(ADMIN_GROUPS),
    ]),

  Trip: a
    .model({
      driverId: a.id(),
      driver: a.belongsTo('User', 'driverId'),
      vehicleType: a.string(),
      capacityKg: a.integer(),
      currentLoadKg: a.integer(),
      status: a.enum(['PROGRAMADO', 'EN_CARGA', 'VIAJANDO', 'FINALIZADO']),
      orders: a.hasMany('Order', 'tripId'),
    })
    .secondaryIndexes((index) => [index('driverId').queryField('listTripsByDriverId')])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
      allow.groups(ADMIN_GROUPS).to(['read']),
    ]),

  /**
   * Peticiones / pendientes para flujos administrativos.
   * Ejemplos:
   * - Solicitud de cambio de rol
   * - Alta de proveedor
   * - Corrección de impuestos/fletes
   */
  Request: a
    .model({
      createdByUserId: a.id().required(),
      createdBy: a.belongsTo('User', 'createdByUserId'),
      assignedToUserId: a.id(),
      requestNumber: a.integer(),
      type: a.enum(['ROLE_CHANGE', 'PROVIDER_ONBOARDING', 'SUPPORT', 'DATA_FIX', 'OTHER']),
      status: a.enum(['OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'DONE']),
      title: a.string().required(),
      details: a.string(),
      payloadJson: a.string(),
      relatedOrderId: a.id(),
    })
    .secondaryIndexes((index) => [
      index('status').sortKeys(['type']).queryField('listRequestsByStatus'),
      index('createdByUserId').queryField('listRequestsByCreator'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.groups(ADMIN_GROUPS),
    ]),

  /**
   * Alertas operativas (campo / coordinación).
   * MVP: cualquier autenticado puede leer; owner/admin pueden crear/editar.
   */
  Alert: a
    .model({
      createdByUserId: a.id().required(),
      municipio: a.string(),
      severity: a.enum(['INFO', 'WARNING', 'CRITICAL']),
      status: a.enum(['OPEN', 'ACK', 'CLOSED']),
      title: a.string().required(),
      message: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('municipio').sortKeys(['createdAt']).queryField('listAlertsByMunicipio'),
      index('createdByUserId').sortKeys(['createdAt']).queryField('listAlertsByCreator'),
      index('status').sortKeys(['severity']).queryField('listAlertsByStatus'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner(),
      allow.groups(ADMIN_GROUPS),
    ]),

  /**
   * Notificaciones personales.
   * Nota: en MVP se permiten self-notifications (owner create) para probar flujo.
   */
  Notification: a
    .model({
      userId: a.id().required(),
      title: a.string().required(),
      message: a.string(),
      read: a.boolean(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('userId').sortKeys(['createdAt']).queryField('listNotificationsByUser'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.groups(ADMIN_GROUPS),
    ]),

  /**
   * Conexiones a APIs externas (precios, clima, etc.)
   * IMPORTANTE: NO guardar secretos aquí. Guardar solo el nombre de secreto.
   */
  ExternalApi: a
    .model({
      name: a.string().required(),
      kind: a.enum(['PRECIOS', 'CLIMA', 'MAPAS', 'IMPUESTOS', 'FLETES', 'OTRO']),
      baseUrl: a.url(),
      authType: a.enum(['NONE', 'API_KEY', 'OAUTH2']),
      secretName: a.string(),
      enabled: a.boolean(),
      jobs: a.hasMany('ExternalSyncJob', 'apiId'),
    })
    .authorization((allow) => [allow.groups(ADMIN_GROUPS)]),

  ExternalSyncJob: a
    .model({
      apiId: a.id().required(),
      api: a.belongsTo('ExternalApi', 'apiId'),
      status: a.enum(['RUNNING', 'SUCCESS', 'FAILED']),
      startedAt: a.datetime(),
      endedAt: a.datetime(),
      summary: a.string(),
      error: a.string(),
    })
    .secondaryIndexes((index) => [index('apiId').sortKeys(['startedAt']).queryField('listJobsByApi')])
    .authorization((allow) => [allow.groups(ADMIN_GROUPS)]),

  PriceReference: a
    .model({
      product: a.string().required(),
      countryCode: a.string(),
      municipio: a.string(),
      market: a.string(),
      date: a.date().required(),
      price: a.float().required(),
      unit: a.string(),
      sourceApiId: a.id(),
    })
    .secondaryIndexes((index) => [
      index('product').sortKeys(['date']).queryField('listPricesByProductAndDate'),
      index('municipio').sortKeys(['date']).queryField('listPricesByMunicipioAndDate'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(ADMIN_GROUPS),
    ]),

  /**
   * Operación administrativa: dispara una sincronización (manual) de una ExternalApi.
   * En producción puede complementarse con scheduling.
   */
  syncExternalApiNow: a
    .mutation()
    .arguments({
      apiId: a.id().required(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(syncExternalData)),

  /**
   * Seguridad municipio (server-side): lista pendientes públicos SOLO del municipio del caller.
   * Fuente municipio: primero claim custom:municipio, si no existe cae a User.municipio.
   */
  listPublicOrdersForMyMunicipio: a
    .query()
    .arguments({
      fromDate: a.string(),
      toDate: a.string(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(secureOrders)),

  /**
   * CRUD remoto seguro: actualiza status en Order y OrderPublic a la vez.
   */
  updateOrderStatusSecure: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      status: a.string().required(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(secureOrders)),

  /**
   * CRUD remoto seguro: crea Order y OrderPublic en una operación.
   * Reglas:
   * - El caller debe tener municipio (claim custom:municipio o perfil User sincronizado)
   * - No admin: solo puede crear en su propio municipio
   */
  createOrderSecure: a
    .mutation()
    .arguments({
      product: a.string().required(),
      quantity: a.float().required(),
      unit: a.string(),
      pickupDate: a.string(),
      municipio: a.string().required(),
      aiAnalysis: a.string(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(secureOrders)),

  /**
   * CRUD remoto seguro: actualiza campos editables en Order y OrderPublic.
   * Reglas:
   * - No admin: solo owner
   * - No admin: municipio no puede cambiar a otro diferente al del caller
   */
  updateOrderSecure: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      product: a.string(),
      quantity: a.float(),
      unit: a.string(),
      pickupDate: a.string(),
      municipio: a.string(),
      status: a.string(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(secureOrders)),

  /**
   * CRUD remoto seguro: borra Order y su OrderPublic correspondiente.
   */
  deleteOrderSecure: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(secureOrders)),

  /**
   * CRUD remoto seguro: crea Request con numeración trazable (requestNumber) server-side.
   * - createdByUserId se toma del caller
   * - status por defecto: OPEN
   */
  createRequestSecure: a
    .mutation()
    .arguments({
      type: a.string().required(),
      title: a.string().required(),
      details: a.string(),
      payloadJson: a.string(),
      relatedOrderId: a.id(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(secureOrders)),
})

export type Schema = ClientSchema<typeof schema>
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
})
