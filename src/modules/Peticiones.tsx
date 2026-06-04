import { useEffect, useMemo, useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'
import type { Schema } from '../../amplify/data/resource'
import { ChatModule } from './Chat'
import { loadProfile } from './Perfil'

type PetitionItem = {
  id: string
  createdAt: string
  createdBy?: string | null
  externalId?: string | null
  product?: string
  quantity?: number
  unit?: string
  pickupDate?: string
  municipio?: string
  missing?: string[]
  notes?: string
  assignedTo?: string | null
  priceOffer?: number | null
  status: 'OPEN' | 'MATCHED' | 'COMPLETED' | 'CANCELLED' | 'PENDIENTE' | 'CONSOLIDADO' | 'TRANSITO' | 'ENTREGADO'
  sent: boolean
  backend?: boolean
}

const STORAGE_KEY = 'agrotrocha.peticiones.v1'

export function loadPetitions(): PetitionItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PetitionItem[]
    return Array.isArray(parsed)
      ? parsed.map((p) => ({
          ...p,
          missing: Array.isArray(p.missing) ? p.missing : [],
          status: p.status ?? 'OPEN',
          sent: typeof p.sent === 'boolean' ? p.sent : false,
        }))
      : []
  } catch {
    return []
  }
}

function savePetitions(items: PetitionItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function parseRemoteId(response: unknown): string | null {
  if (typeof response === 'string') {
    try {
      const parsed = JSON.parse(response) as Record<string, unknown>
      if (typeof parsed.orderId === 'string') return parsed.orderId
      if (typeof parsed.requestId === 'string') return parsed.requestId
      if (typeof parsed.createOrderSecure === 'string') return parsed.createOrderSecure
      if (typeof parsed.createRequestSecure === 'string') return parsed.createRequestSecure
      return response
    } catch {
      return response
    }
  }

  if (!response || typeof response !== 'object') return null
  const maybeResponse = response as Record<string, unknown>
  if (typeof maybeResponse.createOrderSecure === 'string') return maybeResponse.createOrderSecure
  if (typeof maybeResponse.createRequestSecure === 'string') return maybeResponse.createRequestSecure
  if (typeof maybeResponse.requestId === 'string') return maybeResponse.requestId
  if (typeof maybeResponse.orderId === 'string') return maybeResponse.orderId
  if (typeof maybeResponse.data === 'string') {
    return parseRemoteId(maybeResponse.data)
  }

  const data = maybeResponse.data as Record<string, unknown> | undefined
  if (data) {
    if (typeof data.createOrderSecure === 'string') return data.createOrderSecure
    if (typeof data.createRequestSecure === 'string') return data.createRequestSecure
    if (typeof data.requestId === 'string') return data.requestId
    if (typeof data.orderId === 'string') return data.orderId
  }

  return null
}

function extractListItems<T>(value: unknown): T[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value !== 'object') return []

  const item = value as Record<string, unknown>
  if (Array.isArray(item.items)) return item.items as T[]

  for (const key of Object.keys(item)) {
    const nested = extractListItems<T>(item[key])
    if (nested.length > 0) return nested
  }

  return []
}

function mapRemoteOrder(order: Record<string, unknown>): PetitionItem {
  const createdAt = typeof order.createdAt === 'string' ? order.createdAt : String(order.createdAt ?? new Date().toISOString())
  const orderId = typeof order.orderId === 'string' ? order.orderId : typeof order.id === 'string' ? order.id : ''
  const product = typeof order.product === 'string' ? order.product : undefined
  const quantity = typeof order.quantity === 'number' ? order.quantity : typeof order.quantity === 'string' ? Number(order.quantity) : undefined
  const unit = typeof order.unit === 'string' ? order.unit : undefined
  const pickupDate = typeof order.pickupDate === 'string' ? order.pickupDate : undefined
  const municipio = typeof order.municipio === 'string' ? order.municipio : undefined
  const createdBy = typeof order.createdByName === 'string' ? order.createdByName : undefined
  const status =
    typeof order.status === 'string' &&
    ['OPEN', 'MATCHED', 'COMPLETED', 'CANCELLED', 'PENDIENTE', 'CONSOLIDADO', 'TRANSITO', 'ENTREGADO'].includes(order.status)
      ? (order.status as PetitionItem['status'])
      : 'PENDIENTE'

  return {
    id: orderId || crypto.randomUUID(),
    createdAt,
    createdBy,
    externalId: orderId || null,
    product,
    quantity,
    unit,
    pickupDate,
    municipio,
    missing: [],
    notes: undefined,
    assignedTo: null,
    priceOffer: null,
    status,
    sent: true,
    backend: true,
  }
}

export function PeticionesModule({ amplifyReady, isOnline, username, onToast }: { amplifyReady: boolean; isOnline: boolean; username?: string | null; onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void }) {
  const [items, setItems] = useState<PetitionItem[]>(() => loadPetitions())
  const [remoteItems, setRemoteItems] = useState<PetitionItem[]>([])
  const [product, setProduct] = useState('')
  const [quantity, setQuantity] = useState<number | undefined>(undefined)
  const [unit, setUnit] = useState('kg')
  const [pickupDate, setPickupDate] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [missingText, setMissingText] = useState('')
  const [busy, setBusy] = useState(false)
  const [chatFor, setChatFor] = useState<string | null>(null)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const canSync = amplifyReady && isOnline
  const profile = loadProfile()
  const isProducer = profile.role === 'PRODUCTOR'

  useEffect(() => {
    if (!amplifyReady) return
    let cancelled = false
    ;(async () => {
      try {
        const current = await getCurrentUser()
        if (!cancelled) {
          setCurrentUserId((current as any)?.attributes?.sub ?? (current as any)?.username ?? null)
        }
      } catch {
        if (!cancelled) setCurrentUserId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [amplifyReady])

  const mergedItems = useMemo(() => {
    const combined = [...items]
    for (const remote of remoteItems) {
      if (!remote.externalId) {
        combined.push(remote)
        continue
      }
      const index = combined.findIndex((item) => item.externalId && item.externalId === remote.externalId)
      if (index >= 0) {
        combined[index] = { ...combined[index], ...remote, sent: true }
      } else {
        combined.push(remote)
      }
    }
    return combined
      .slice()
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  }, [items, remoteItems])

  useEffect(() => {
    savePetitions(items)
  }, [items])

  useEffect(() => {
    if (!canSync) return
    const pending = items.filter((i) => !i.sent)
    if (pending.length === 0) return

    let cancelled = false
    async function flush() {
      for (const p of pending) {
        if (cancelled) return
        try {
          await sendPetitionToBackend(p)
        } catch (error) {
          console.warn('peticion flush failed', error)
        }
      }
      await loadRemoteOrders()
    }
    flush()
    return () => {
      cancelled = true
    }
  }, [canSync, items])

  useEffect(() => {
    if (!canSync) return
    let cancelled = false
    const run = async () => {
      try {
        await loadRemoteOrders()
      } catch (error) {
        if (!cancelled) console.warn('load remote orders failed', error)
      }
    }
    // First run
    void run()
    // Poll every 30s while connected
    const id = setInterval(() => {
      void run()
    }, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [canSync, profile.role, username, profile.municipio, currentUserId])

  const summary = useMemo(
    () => `${items.filter((i) => i.status === 'OPEN').length} abiertas · ${items.filter((i) => i.status === 'MATCHED').length} emparejadas`,
    [items],
  )

  async function loadRemoteOrders() {
    setLastSyncError(null)
    try {
      const client = generateClient<Schema>()
      let response: unknown = null

      if (isProducer) {
        const creatorId = currentUserId ?? username
        if (!creatorId) {
          setRemoteItems([])
          return
        }
        response = await client.models.OrderPublic.listPublicOrdersByCreator({ createdByUserId: creatorId })
      } else if (profile.municipio) {
        response = await client.models.OrderPublic.listPublicOrdersByMunicipioAndPickupDate({
          municipio: profile.municipio,
        })
      }

      if (!response) {
        setRemoteItems([])
        return
      }

      const list = extractListItems<Record<string, unknown>>(response)
      setRemoteItems(list.map(mapRemoteOrder))
    } catch (error) {
      setLastSyncError('No se pudieron cargar pedidos remotos.')
      console.warn('loadRemoteOrders error', error)
    }
  }

  async function createPetition() {
    if (!product.trim()) return onToast({ kind: 'error', message: 'Producto requerido' })

    const p: PetitionItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: username ?? null,
      product: product.trim(),
      quantity: quantity ?? undefined,
      unit,
      pickupDate: pickupDate || undefined,
      municipio: municipio || undefined,
      missing: missingText ? missingText.split(',').map((s) => s.trim()).filter(Boolean) : [],
      notes: undefined,
      assignedTo: null,
      priceOffer: null,
      status: 'OPEN',
      sent: false,
    }

    setItems((prev) => [p, ...prev])
    setProduct('')
    setQuantity(undefined)
    setUnit('kg')
    setPickupDate('')
    setMunicipio('')
    setMissingText('')

    if (!canSync) return onToast({ kind: 'info', message: 'Peticiones guardadas localmente. Se enviarán cuando haya conexión.' })

    await sendPetitionToBackend(p)
  }

  async function sendPetitionToBackend(p: PetitionItem) {
    setBusy(true)
    try {
      const client = generateClient<Schema>()
      if (client.mutations?.createOrderSecure) {
        const response = await client.mutations.createOrderSecure({
          product: p.product ?? '',
          quantity: p.quantity ?? 0,
          unit: p.unit,
          pickupDate: p.pickupDate,
          municipio: p.municipio ?? '',
          aiAnalysis: undefined,
        })
        const orderId = parseRemoteId(response)
        setItems((prev) =>
          prev.map((it) =>
            it.id === p.id
              ? {
                  ...it,
                  sent: true,
                  externalId: orderId ?? null,
                  status: 'PENDIENTE',
                }
              : it,
          ),
        )
        onToast({ kind: 'success', message: 'Petición guardada en backend.' })
        await loadRemoteOrders()
      } else if (client.mutations?.createRequestSecure) {
        const body = {
          type: 'OTHER',
          title: `Peticiones: ${p.product ?? 'producto'}`,
          details: p.notes || undefined,
          payloadJson: JSON.stringify({ product: p.product, quantity: p.quantity, unit: p.unit, pickupDate: p.pickupDate, municipio: p.municipio, missing: p.missing }),
        }
        const response = await client.mutations.createRequestSecure(body)
        const requestId = parseRemoteId(response)
        setItems((prev) =>
          prev.map((it) =>
            it.id === p.id
              ? {
                  ...it,
                  sent: true,
                  externalId: requestId ?? null,
                }
              : it,
          ),
        )
        onToast({ kind: 'success', message: 'Petición enviada al backend.' })
      } else {
        throw new Error('No backend mutation available')
      }
    } catch (e) {
      console.warn('peticion send failed', e)
      onToast({ kind: 'error', message: 'No se pudo enviar la petición. Queda en cola.' })
    } finally {
      setBusy(false)
    }
  }

  function joinPetition(id: string, who: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, assignedTo: who, status: 'MATCHED' } : it)))
    onToast({ kind: 'success', message: 'Te has unido a la petición.' })
  }

  return (
    <div className="space-y-6">
      {isProducer ? (
        <section className="rounded-3xl border p-6 bg-white/70">
          <div className="text-xl font-semibold">Peticiones</div>
          <div className="text-sm text-zinc-600">Conecta productores y transportistas — guarda toda la información siguiendo el esquema de datos.</div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input placeholder="Producto" value={product} onChange={(e) => setProduct(e.target.value)} className="rounded-2xl border px-3 py-2" />
            <input placeholder="Cantidad" value={quantity ?? ''} onChange={(e) => setQuantity(Number(e.target.value || 0) || undefined)} className="rounded-2xl border px-3 py-2" />
            <input placeholder="Unidad" value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-2xl border px-3 py-2" />
            <input placeholder="Fecha de recolección" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="rounded-2xl border px-3 py-2" />
            <input placeholder="Municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)} className="rounded-2xl border px-3 py-2" />
            <input placeholder="Items faltantes (coma separated)" value={missingText} onChange={(e) => setMissingText(e.target.value)} className="rounded-2xl border px-3 py-2" />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button disabled={busy} onClick={createPetition} className="rounded-2xl bg-emerald-600 px-4 py-2 text-white">{busy ? 'Enviando…' : 'Crear petición'}</button>
            <div className="px-3 py-2 text-sm text-zinc-600">{summary}</div>
          </div>
          {!canSync ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No hay conexión con el backend. Las peticiones se quedarán en cola hasta restaurarla.
            </div>
          ) : null}
          {lastSyncError ? <div className="mt-3 text-sm text-rose-600">{lastSyncError}</div> : null}
        </section>
      ) : (
        <section className="rounded-3xl border p-6 bg-white/70">
          <div className="text-xl font-semibold">Peticiones</div>
          <div className="text-sm text-zinc-600">Estás viendo las peticiones públicas — usa el botón "Ofrecer servicio" para unirte.</div>
          {!canSync ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Sin backend no se cargarán las peticiones públicas.
            </div>
          ) : null}
        </section>
      )}

      <section className="rounded-3xl border p-6 bg-white/70">
        <div className="text-lg font-semibold">Listado</div>
        <div className="mt-3 space-y-3">
          {mergedItems.map((it) => (
            <div key={it.id} className="rounded-2xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{it.product} {it.quantity ? `· ${it.quantity} ${it.unit}` : ''}</div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${it.sent ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                  {it.sent ? 'Sincronizado' : 'Pendiente'}
                </span>
              </div>
              <div className="text-xs text-zinc-500">{it.municipio ?? 'varios'} · {new Date(it.createdAt).toLocaleString()}</div>
              {it.externalId ? <div className="mt-2 text-xs text-zinc-500">ID backend: {it.externalId}</div> : null}
              <div className="mt-2 text-sm">{it.missing?.length ? `Faltantes: ${it.missing.join(', ')}` : 'Sin faltantes registrados'}</div>
              <div className="mt-2 text-sm text-zinc-600">Estado: {it.status}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!isProducer && !it.backend ? (
                  <button onClick={() => joinPetition(it.id, username ?? 'Transportista')} className="rounded-2xl border px-3 py-2">Ofrecer servicio</button>
                ) : null}
                <button onClick={() => setChatFor(it.id)} className="rounded-2xl border px-3 py-2">Chat</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {chatFor ? <ChatModule petitionId={chatFor} username={username} onClose={() => setChatFor(null)} /> : null}
    </div>
  )
}
