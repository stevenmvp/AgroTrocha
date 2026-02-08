import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'

type IdentityLike = {
  sub?: string
  claims?: Record<string, unknown>
}

type AppSyncEventLike = {
  arguments?: Record<string, unknown>
  identity?: IdentityLike
  info?: { fieldName?: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStringClaim(identity: IdentityLike | undefined, key: string): string | null {
  const claims = identity?.claims
  if (!claims) return null
  const v = claims[key]
  return typeof v === 'string' && v.trim() ? v : null
}

function getGroups(identity: IdentityLike | undefined): string[] {
  const raw = identity?.claims?.['cognito:groups']
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string') as string[]
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((s) => s.trim())
  return []
}

function isAdmin(identity: IdentityLike | undefined): boolean {
  const groups = getGroups(identity)
  return groups.includes('ADMIN') || groups.includes('STAFF')
}

function normalizeMunicipio(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

async function nextSequence(name: string): Promise<number> {
  const table = requiredEnv('SEQUENCE_TABLE')
  const now = new Date().toISOString()

  const resp = await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { id: name },
      UpdateExpression: 'SET #v = if_not_exists(#v, :z) + :inc, #u = :u',
      ExpressionAttributeNames: { '#v': 'value', '#u': 'updatedAt' },
      ExpressionAttributeValues: { ':inc': 1, ':z': 0, ':u': now },
      ReturnValues: 'UPDATED_NEW',
    })
  )

  const raw = isRecord(resp.Attributes) ? resp.Attributes.value : null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) throw new Error('Sequence increment failed')
  return n
}

async function resolveCallerMunicipio(identity: IdentityLike | undefined): Promise<string> {
  const fromClaim = getStringClaim(identity, 'custom:municipio')
  if (fromClaim) return fromClaim

  const userId = getStringClaim(identity, 'sub') ?? (typeof identity?.sub === 'string' ? identity.sub : null)
  if (!userId) throw new Error('No identity sub')

  const userTable = requiredEnv('USER_TABLE')
  const userResp = await ddb.send(new GetCommand({ TableName: userTable, Key: { id: userId } }))
  const municipio = isRecord(userResp.Item) ? userResp.Item.municipio : null
  if (typeof municipio === 'string' && municipio.trim()) return municipio

  throw new Error('Missing municipio (sync your profile)')
}

async function resolveCallerDisplayName(identity: IdentityLike | undefined): Promise<string> {
  const userId = getStringClaim(identity, 'sub') ?? (typeof identity?.sub === 'string' ? identity.sub : null)

  const fromClaims =
    getStringClaim(identity, 'name') ??
    getStringClaim(identity, 'cognito:username') ??
    getStringClaim(identity, 'email')
  if (!userId) return fromClaims ?? 'Usuario'

  try {
    const userTable = requiredEnv('USER_TABLE')
    const userResp = await ddb.send(new GetCommand({ TableName: userTable, Key: { id: userId } }))
    const name = isRecord(userResp.Item) ? userResp.Item.name : null
    if (typeof name === 'string' && name.trim()) return name
  } catch {
    // ignore
  }

  return fromClaims ?? 'Usuario'
}

async function scanOrderPublicByMunicipio(params: {
  municipio: string
  fromDate?: string | null
  toDate?: string | null
}) {
  const table = requiredEnv('ORDER_PUBLIC_TABLE')
  const exprNames: Record<string, string> = { '#m': 'municipio' }
  const exprValues: Record<string, unknown> = { ':m': params.municipio }
  const filters: string[] = ['#m = :m']

  if (params.fromDate) {
    exprNames['#pd'] = 'pickupDate'
    exprValues[':from'] = params.fromDate
    filters.push('(#pd >= :from OR attribute_not_exists(#pd))')
  }
  if (params.toDate) {
    exprNames['#pd'] = 'pickupDate'
    exprValues[':to'] = params.toDate
    filters.push('(#pd <= :to OR attribute_not_exists(#pd))')
  }

  const resp = await ddb.send(
    new ScanCommand({
      TableName: table,
      FilterExpression: filters.join(' AND '),
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
      Limit: 200,
    })
  )

  const items = Array.isArray(resp.Items) ? resp.Items : []
  return items
}

async function scanOrderPublicByOrderId(orderId: string) {
  const table = requiredEnv('ORDER_PUBLIC_TABLE')
  const resp = await ddb.send(
    new ScanCommand({
      TableName: table,
      FilterExpression: '#oid = :oid',
      ExpressionAttributeNames: { '#oid': 'orderId' },
      ExpressionAttributeValues: { ':oid': orderId },
      Limit: 1,
    })
  )
  const item = Array.isArray(resp.Items) && resp.Items.length > 0 ? resp.Items[0] : null
  return item
}

async function updateOrderStatus(params: { orderId: string; status: string; identity: IdentityLike | undefined }) {
  const orderTable = requiredEnv('ORDER_TABLE')
  const publicTable = requiredEnv('ORDER_PUBLIC_TABLE')

  const orderResp = await ddb.send(new GetCommand({ TableName: orderTable, Key: { id: params.orderId } }))
  const order = orderResp.Item
  if (!isRecord(order)) throw new Error('Order not found')

  const callerSub = getStringClaim(params.identity, 'sub') ?? params.identity?.sub ?? null
  const ownerId = typeof order.userId === 'string' ? order.userId : null

  if (!isAdmin(params.identity) && (!callerSub || !ownerId || callerSub !== ownerId)) {
    throw new Error('Not authorized')
  }

  const now = new Date().toISOString()

  await ddb.send(
    new UpdateCommand({
      TableName: orderTable,
      Key: { id: params.orderId },
      UpdateExpression: 'SET #s = :s, #u = :u',
      ExpressionAttributeNames: { '#s': 'status', '#u': 'updatedAt' },
      ExpressionAttributeValues: { ':s': params.status, ':u': now },
    })
  )

  const publicItem = await scanOrderPublicByOrderId(params.orderId)
  if (isRecord(publicItem) && typeof publicItem.id === 'string') {
    await ddb.send(
      new UpdateCommand({
        TableName: publicTable,
        Key: { id: publicItem.id },
        UpdateExpression: 'SET #s = :s, #u = :u',
        ExpressionAttributeNames: { '#s': 'status', '#u': 'updatedAt' },
        ExpressionAttributeValues: { ':s': params.status, ':u': now },
      })
    )
  }

  return 'OK'
}

async function deleteOrder(params: { orderId: string; identity: IdentityLike | undefined }) {
  const orderTable = requiredEnv('ORDER_TABLE')
  const publicTable = requiredEnv('ORDER_PUBLIC_TABLE')

  const orderResp = await ddb.send(new GetCommand({ TableName: orderTable, Key: { id: params.orderId } }))
  const order = orderResp.Item
  if (!isRecord(order)) throw new Error('Order not found')

  const callerSub = getStringClaim(params.identity, 'sub') ?? params.identity?.sub ?? null
  const ownerId = typeof order.userId === 'string' ? order.userId : null

  if (!isAdmin(params.identity) && (!callerSub || !ownerId || callerSub !== ownerId)) {
    throw new Error('Not authorized')
  }

  const publicItem = await scanOrderPublicByOrderId(params.orderId)
  if (isRecord(publicItem) && typeof publicItem.id === 'string') {
    await ddb.send(new DeleteCommand({ TableName: publicTable, Key: { id: publicItem.id } }))
  }

  await ddb.send(new DeleteCommand({ TableName: orderTable, Key: { id: params.orderId } }))
  return 'OK'
}

async function createOrder(params: {
  product: string
  quantity: number
  unit?: string | null
  pickupDate?: string | null
  municipio: string
  aiAnalysis?: string | null
  identity: IdentityLike | undefined
}) {
  const callerSub = getStringClaim(params.identity, 'sub') ?? params.identity?.sub ?? null
  if (!callerSub) throw new Error('No identity sub')

  const callerMunicipio = await resolveCallerMunicipio(params.identity)
  const requestedMunicipio = params.municipio

  if (!isAdmin(params.identity)) {
    if (normalizeMunicipio(callerMunicipio) !== normalizeMunicipio(requestedMunicipio)) {
      throw new Error('Not authorized (municipio mismatch)')
    }
  }

  const orderTable = requiredEnv('ORDER_TABLE')
  const publicTable = requiredEnv('ORDER_PUBLIC_TABLE')

  const now = new Date().toISOString()
  const orderNumber = await nextSequence('ORDER')
  const orderId = randomUUID()
  const publicId = randomUUID()
  const createdByName = await resolveCallerDisplayName(params.identity)

  await ddb.send(
    new PutCommand({
      TableName: orderTable,
      Item: {
        id: orderId,
        userId: callerSub,
        orderNumber,
        product: params.product,
        quantity: params.quantity,
        unit: params.unit ?? null,
        pickupDate: params.pickupDate ?? null,
        municipio: requestedMunicipio,
        status: 'PENDIENTE',
        aiAnalysis: params.aiAnalysis ?? null,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: { '#id': 'id' },
    })
  )

  await ddb.send(
    new PutCommand({
      TableName: publicTable,
      Item: {
        id: publicId,
        orderId,
        orderNumber,
        createdByUserId: callerSub,
        createdByName,
        municipio: requestedMunicipio,
        pickupDate: params.pickupDate ?? null,
        product: params.product,
        quantity: params.quantity,
        unit: params.unit ?? null,
        status: 'PENDIENTE',
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: { '#id': 'id' },
    })
  )

  return orderId
}

async function createRequest(params: {
  type: string
  title: string
  details?: string | null
  payloadJson?: string | null
  relatedOrderId?: string | null
  identity: IdentityLike | undefined
}) {
  const callerSub = getStringClaim(params.identity, 'sub') ?? params.identity?.sub ?? null
  if (!callerSub) throw new Error('No identity sub')

  const requestTable = requiredEnv('REQUEST_TABLE')
  const now = new Date().toISOString()
  const requestNumber = await nextSequence('REQUEST')
  const id = randomUUID()

  await ddb.send(
    new PutCommand({
      TableName: requestTable,
      Item: {
        id,
        createdByUserId: callerSub,
        requestNumber,
        type: params.type,
        status: 'OPEN',
        title: params.title,
        details: params.details ?? null,
        payloadJson: params.payloadJson ?? null,
        relatedOrderId: params.relatedOrderId ?? null,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: { '#id': 'id' },
    })
  )

  return JSON.stringify({ ok: true, requestId: id, requestNumber })
}

async function updateOrder(params: {
  orderId: string
  patch: {
    product?: string | null
    quantity?: number | null
    unit?: string | null
    pickupDate?: string | null
    municipio?: string | null
    status?: string | null
  }
  identity: IdentityLike | undefined
}) {
  const orderTable = requiredEnv('ORDER_TABLE')
  const publicTable = requiredEnv('ORDER_PUBLIC_TABLE')

  const orderResp = await ddb.send(new GetCommand({ TableName: orderTable, Key: { id: params.orderId } }))
  const order = orderResp.Item
  if (!isRecord(order)) throw new Error('Order not found')

  const callerSub = getStringClaim(params.identity, 'sub') ?? params.identity?.sub ?? null
  const ownerId = typeof order.userId === 'string' ? order.userId : null
  if (!isAdmin(params.identity) && (!callerSub || !ownerId || callerSub !== ownerId)) {
    throw new Error('Not authorized')
  }

  // Municipio enforcement
  if (!isAdmin(params.identity) && params.patch.municipio) {
    const callerMunicipio = await resolveCallerMunicipio(params.identity)
    if (normalizeMunicipio(callerMunicipio) !== normalizeMunicipio(params.patch.municipio)) {
      throw new Error('Not authorized (municipio mismatch)')
    }
  }

  const now = new Date().toISOString()
  const sets: string[] = ['#u = :u']
  const names: Record<string, string> = { '#u': 'updatedAt' }
  const values: Record<string, unknown> = { ':u': now }

  if (typeof params.patch.product === 'string') {
    names['#p'] = 'product'
    values[':p'] = params.patch.product
    sets.push('#p = :p')
  }
  if (typeof params.patch.quantity === 'number') {
    names['#q'] = 'quantity'
    values[':q'] = params.patch.quantity
    sets.push('#q = :q')
  }
  if (typeof params.patch.unit === 'string') {
    names['#un'] = 'unit'
    values[':un'] = params.patch.unit
    sets.push('#un = :un')
  }
  if (typeof params.patch.pickupDate === 'string') {
    names['#pd'] = 'pickupDate'
    values[':pd'] = params.patch.pickupDate
    sets.push('#pd = :pd')
  }
  if (typeof params.patch.municipio === 'string') {
    names['#m'] = 'municipio'
    values[':m'] = params.patch.municipio
    sets.push('#m = :m')
  }
  if (typeof params.patch.status === 'string') {
    names['#s'] = 'status'
    values[':s'] = params.patch.status
    sets.push('#s = :s')
  }

  await ddb.send(
    new UpdateCommand({
      TableName: orderTable,
      Key: { id: params.orderId },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  )

  const publicItem = await scanOrderPublicByOrderId(params.orderId)
  if (isRecord(publicItem) && typeof publicItem.id === 'string') {
    const publicSets: string[] = ['#u = :u']
    const publicNames: Record<string, string> = { '#u': 'updatedAt' }
    const publicValues: Record<string, unknown> = { ':u': now }

    if (typeof params.patch.product === 'string') {
      publicNames['#p'] = 'product'
      publicValues[':p'] = params.patch.product
      publicSets.push('#p = :p')
    }
    if (typeof params.patch.quantity === 'number') {
      publicNames['#q'] = 'quantity'
      publicValues[':q'] = params.patch.quantity
      publicSets.push('#q = :q')
    }
    if (typeof params.patch.unit === 'string') {
      publicNames['#un'] = 'unit'
      publicValues[':un'] = params.patch.unit
      publicSets.push('#un = :un')
    }
    if (typeof params.patch.pickupDate === 'string') {
      publicNames['#pd'] = 'pickupDate'
      publicValues[':pd'] = params.patch.pickupDate
      publicSets.push('#pd = :pd')
    }
    if (typeof params.patch.municipio === 'string') {
      publicNames['#m'] = 'municipio'
      publicValues[':m'] = params.patch.municipio
      publicSets.push('#m = :m')
    }
    if (typeof params.patch.status === 'string') {
      publicNames['#s'] = 'status'
      publicValues[':s'] = params.patch.status
      publicSets.push('#s = :s')
    }

    await ddb.send(
      new UpdateCommand({
        TableName: publicTable,
        Key: { id: publicItem.id },
        UpdateExpression: `SET ${publicSets.join(', ')}`,
        ExpressionAttributeNames: publicNames,
        ExpressionAttributeValues: publicValues,
      })
    )
  }

  return 'OK'
}

function getArgString(args: Record<string, unknown> | undefined, key: string): string | null {
  const v = args?.[key]
  return typeof v === 'string' ? v : null
}

function getItemString(item: Record<string, unknown>, key: string): string | null {
  const v = item[key]
  return typeof v === 'string' ? v : null
}

function getItemNumber(item: Record<string, unknown>, key: string): number | null {
  const v = item[key]
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

export const handler = async (event: unknown): Promise<unknown> => {
  // The schema attaches this function to multiple fields; switch by field name.
  const e = (isRecord(event) ? (event as AppSyncEventLike) : {})
  const fieldName = typeof e.info?.fieldName === 'string' ? e.info.fieldName : ''
  const identity = e.identity

  if (fieldName === 'listPublicOrdersForMyMunicipio') {
    const municipio = await resolveCallerMunicipio(identity)
    const fromDate = getArgString(e.arguments, 'fromDate')
    const toDate = getArgString(e.arguments, 'toDate')

    const items = await scanOrderPublicByMunicipio({ municipio, fromDate, toDate })
    const payload = items
      .filter((it): it is Record<string, unknown> => isRecord(it))
      .map((it) => ({
        id: getItemString(it, 'id'),
        orderId: getItemString(it, 'orderId'),
        orderNumber: getItemNumber(it, 'orderNumber'),
        createdByUserId: getItemString(it, 'createdByUserId'),
        createdByName: getItemString(it, 'createdByName'),
        municipio: getItemString(it, 'municipio'),
        pickupDate: getItemString(it, 'pickupDate'),
        product: getItemString(it, 'product'),
        quantity: getItemNumber(it, 'quantity'),
        unit: getItemString(it, 'unit'),
        status: getItemString(it, 'status'),
        createdAt: getItemString(it, 'createdAt'),
        updatedAt: getItemString(it, 'updatedAt'),
      }))

    return JSON.stringify(payload)
  }

  if (fieldName === 'updateOrderStatusSecure') {
    const orderId = getArgString(e.arguments, 'orderId')
    const status = getArgString(e.arguments, 'status')
    if (!orderId || !status) throw new Error('Missing args')
    return updateOrderStatus({ orderId, status, identity })
  }

  if (fieldName === 'createOrderSecure') {
    const product = getArgString(e.arguments, 'product')
    const municipio = getArgString(e.arguments, 'municipio')
    const unit = getArgString(e.arguments, 'unit')
    const pickupDate = getArgString(e.arguments, 'pickupDate')
    const aiAnalysis = getArgString(e.arguments, 'aiAnalysis')
    const qtyRaw = e.arguments?.quantity
    const quantity = typeof qtyRaw === 'number' ? qtyRaw : typeof qtyRaw === 'string' ? Number(qtyRaw) : NaN

    if (!product || !municipio || !Number.isFinite(quantity)) throw new Error('Missing args')
    return createOrder({
      product,
      quantity,
      unit,
      pickupDate,
      municipio,
      aiAnalysis,
      identity,
    })
  }

  if (fieldName === 'updateOrderSecure') {
    const orderId = getArgString(e.arguments, 'orderId')
    if (!orderId) throw new Error('Missing args')

    const qtyRaw = e.arguments?.quantity
    const quantity = typeof qtyRaw === 'number' ? qtyRaw : typeof qtyRaw === 'string' ? Number(qtyRaw) : null

    return updateOrder({
      orderId,
      patch: {
        product: getArgString(e.arguments, 'product'),
        quantity: quantity !== null && Number.isFinite(quantity) ? quantity : undefined,
        unit: getArgString(e.arguments, 'unit'),
        pickupDate: getArgString(e.arguments, 'pickupDate'),
        municipio: getArgString(e.arguments, 'municipio'),
        status: getArgString(e.arguments, 'status'),
      },
      identity,
    })
  }

  if (fieldName === 'deleteOrderSecure') {
    const orderId = getArgString(e.arguments, 'orderId')
    if (!orderId) throw new Error('Missing args')
    return deleteOrder({ orderId, identity })
  }

  if (fieldName === 'createRequestSecure') {
    const type = getArgString(e.arguments, 'type')
    const title = getArgString(e.arguments, 'title')
    if (!type || !title) throw new Error('Missing args')
    return createRequest({
      type,
      title,
      details: getArgString(e.arguments, 'details'),
      payloadJson: getArgString(e.arguments, 'payloadJson'),
      relatedOrderId: getArgString(e.arguments, 'relatedOrderId'),
      identity,
    })
  }

  throw new Error(`Unsupported field: ${fieldName}`)
}
