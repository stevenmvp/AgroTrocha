import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'
import { analyzeTextWithAI, type ParsedOrder } from '../lib/orderAnalyze'
import { getErrorMessage } from '../lib/getErrorMessage'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import type { NavKey } from '../components/BottomNav'
import { setNavIntent } from '../state/navIntent'

type Role = 'PRODUCTOR' | 'TRANSPORTISTA'

type OrderDraft = {
  rawText: string
  municipio?: string
}

type PendingQueueItem = {
  id: string
  createdAt: string
  payload: OrderDraft
}

type OrderOp =
  | {
      id: string
      createdAt: string
      kind: 'update'
      orderId: string
      patch: {
        product: string
        quantity: number
        unit?: string
        pickupDate?: string
        municipio: string
      }
    }
  | {
      id: string
      createdAt: string
      kind: 'status'
      orderId: string
      status: string
    }
  | {
      id: string
      createdAt: string
      kind: 'delete'
      orderId: string
    }

type PublicOrderView = {
  id?: string | null
  orderId?: string | null
  orderNumber?: number | null
  createdByUserId?: string | null
  createdByName?: string | null
  createdByRole?: string | null
  createdByVereda?: string | null
  createdByPhone?: string | null
  municipio?: string | null
  pickupDate?: string | null
  product?: string | null
  quantity?: number | null
  unit?: string | null
  status?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

const QUEUE_KEY = 'agrotrocha.pendingOrders.v1'
const OPS_KEY = 'agrotrocha.orderOps.v1'

function loadQueue(): PendingQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PendingQueueItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveQueue(queue: PendingQueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

function loadOps(): OrderOp[] {
  try {
    const raw = localStorage.getItem(OPS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OrderOp[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveOps(next: OrderOp[]) {
  localStorage.setItem(OPS_KEY, JSON.stringify(next))
}

function makeId() {
  return crypto.randomUUID()
}

function safeParseJsonObject(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const slice = text.slice(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch {
    return null
  }
}

export function PendientesModule({
  amplifyReady,
  isOnline,
  density,
  sttEnabled,
  onToast,
  onNavigate,
}: {
  amplifyReady: boolean
  isOnline: boolean
  density: 'compact' | 'comfortable'
  sttEnabled: boolean
  username: string | null
  onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void
  onNavigate?: (key: NavKey) => void
}) {
  const [role, setRole] = useState<Role>('PRODUCTOR')
  const [rawText, setRawText] = useState('Tengo 30 bultos de cebolla para el viernes en Aquitania')
  const [queue, setQueue] = useState<PendingQueueItem[]>(() => loadQueue())
  const [ops, setOps] = useState<OrderOp[]>(() => loadOps())
  const [lastParsed, setLastParsed] = useState<ParsedOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [publicOrders, setPublicOrders] = useState<PublicOrderView[]>([])
  const [publicBusy, setPublicBusy] = useState(false)
  const [myOrders, setMyOrders] = useState<Schema['OrderPublic']['type'][]>([])
  const [myBusy, setMyBusy] = useState(false)
  const [listening, setListening] = useState(false)

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [editProduct, setEditProduct] = useState('')
  const [editQuantity, setEditQuantity] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editPickupDate, setEditPickupDate] = useState('')
  const [editMunicipio, setEditMunicipio] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  const [syncingQueue, setSyncingQueue] = useState(false)
  const [syncingOps, setSyncingOps] = useState(false)

  useEffect(() => {
    saveQueue(queue)
  }, [queue])

  useEffect(() => {
    saveOps(ops)
  }, [ops])

  useEffect(() => {
    if (!amplifyReady || !isOnline) return
    if (syncingQueue || syncingOps) return
    if (queue.length === 0 && ops.length === 0) return

    async function flushAll() {
      const client = generateClient<Schema>()

      if (queue.length > 0) {
        setSyncingQueue(true)
        try {
          const itemsToSend = queue.slice(0, 10)
          for (const item of itemsToSend) {
            const parsed = await analyzeTextWithAI(item.payload.rawText)
            if (!parsed) continue
            const aiAnalysis = JSON.stringify(parsed)
            await client.mutations.createOrderSecure({
              product: parsed.product,
              quantity: parsed.quantity,
              unit: parsed.unit,
              pickupDate: parsed.pickupDate,
              municipio: parsed.municipio,
              aiAnalysis,
            })
            setQueue((prev) => prev.filter((x) => x.id !== item.id))
          }
        } catch {
          // Keep queue; retry later.
        } finally {
          setSyncingQueue(false)
        }
      }

      if (ops.length > 0) {
        setSyncingOps(true)
        try {
          const opsToSend = ops.slice(0, 20)
          for (const op of opsToSend) {
            if (op.kind === 'status') {
              await client.mutations.updateOrderStatusSecure({ orderId: op.orderId, status: op.status })
            } else if (op.kind === 'delete') {
              await client.mutations.deleteOrderSecure({ orderId: op.orderId })
            } else {
              await client.mutations.updateOrderSecure({
                orderId: op.orderId,
                product: op.patch.product,
                quantity: op.patch.quantity,
                unit: op.patch.unit,
                pickupDate: op.patch.pickupDate,
                municipio: op.patch.municipio,
              })
            }
            setOps((prev) => prev.filter((x) => x.id !== op.id))
          }
        } catch {
          // Keep ops; retry later.
        } finally {
          setSyncingOps(false)
        }
      }
    }

    void flushAll()
  }, [amplifyReady, isOnline, queue, ops, syncingQueue, syncingOps])

  const pendingCount = queue.length
  const pendingOpsCount = ops.length

  const headerBadge = useMemo(() => {
    if (!isOnline) return { label: 'Offline', className: 'bg-amber-100 text-amber-800' }
    return { label: 'Online', className: 'bg-emerald-100 text-emerald-800' }
  }, [isOnline])

  async function refreshPublicOrders() {
    if (!amplifyReady || !isOnline) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setPublicBusy(true)
    try {
      const client = generateClient<Schema>()
      const res = await client.queries.listPublicOrdersForMyMunicipio({})
      const items = (() => {
        if (typeof res.data !== 'string') return [] as PublicOrderView[]
        try {
          const parsed = JSON.parse(res.data) as unknown
          return Array.isArray(parsed) ? (parsed as PublicOrderView[]) : []
        } catch {
          return [] as PublicOrderView[]
        }
      })()

      // Enriquecer con displayName real si existe.
      const uniqueCreatorIds = Array.from(
        new Set(
          items
            .map((i) => i.createdByUserId)
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        )
      )
      const map = new Map<
        string,
        {
          displayName?: string
          role?: string
          vereda?: string
          phone?: string
        }
      >()
      await Promise.all(
        uniqueCreatorIds.slice(0, 25).map(async (id) => {
          try {
            const u = await client.models.UserPublic.get({ id })
            if (u.data) {
              map.set(id, {
                displayName: u.data.displayName ?? undefined,
                role: (u.data.role as unknown as string | null | undefined) ?? undefined,
                vereda: u.data.vereda ?? undefined,
                phone: u.data.phone ?? undefined,
              })
            }
          } catch {
            // ignore
          }
        })
      )

      setPublicOrders(
        items.map((o) => ({
          ...o,
          createdByName:
            (typeof o.createdByUserId === 'string' ? map.get(o.createdByUserId)?.displayName : undefined) ??
            o.createdByName,
          createdByRole:
            (typeof o.createdByUserId === 'string' ? map.get(o.createdByUserId)?.role : undefined) ?? null,
          createdByVereda:
            (typeof o.createdByUserId === 'string' ? map.get(o.createdByUserId)?.vereda : undefined) ?? null,
          createdByPhone:
            (typeof o.createdByUserId === 'string' ? map.get(o.createdByUserId)?.phone : undefined) ?? null,
        }))
      )
      onToast({ kind: 'success', message: `Encontré ${items.length} pendientes de tu municipio.` })
    } catch (e) {
      const msg = getErrorMessage(e)
      onToast({ kind: 'error', message: `No pude cargar pendientes: ${msg}` })
    } finally {
      setPublicBusy(false)
    }
  }

  async function refreshMyOrders() {
    if (!amplifyReady || !isOnline) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }
    setMyBusy(true)
    try {
      const current = await getCurrentUser()
      const client = generateClient<Schema>()
      const res = await client.models.OrderPublic.listPublicOrdersByCreator({
        createdByUserId: current.userId,
      })
      setMyOrders(res.data ?? [])
    } catch (e) {
      onToast({ kind: 'error', message: `No pude cargar tus pendientes: ${getErrorMessage(e)}` })
    } finally {
      setMyBusy(false)
    }
  }

  function startDictation() {
    if (!sttEnabled) {
      onToast({ kind: 'info', message: 'Dictado desactivado en Configuración.' })
      return
    }

    type SpeechRecognitionCtor = new () => {
      lang: string
      interimResults: boolean
      continuous: boolean
      start: () => void
      onresult: ((event: unknown) => void) | null
      onerror: ((event: unknown) => void) | null
      onend: (() => void) | null
    }

    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }

    const SpeechRecognition = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SpeechRecognition) {
      onToast({ kind: 'info', message: 'Este navegador no soporta dictado.' })
      return
    }

    try {
      const rec = new SpeechRecognition()
      rec.lang = 'es-ES'
      rec.interimResults = true
      rec.continuous = false

      setListening(true)
      let finalText = ''

      rec.onresult = (e) => {
        const ev = e as {
          resultIndex: number
          results: ArrayLike<{
            isFinal: boolean
            0?: { transcript?: unknown }
          }>
        }
        let interim = ''
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i]
          const t = String(res?.[0]?.transcript ?? '')
          if (res.isFinal) finalText += t
          else interim += t
        }
        setRawText((prev) => {
          const base = prev.trim().length ? prev.trim() + ' ' : ''
          return (base + (finalText || interim)).trim()
        })
      }

      rec.onerror = () => {
        setListening(false)
        onToast({ kind: 'error', message: 'Error de dictado.' })
      }

      rec.onend = () => {
        setListening(false)
      }

      rec.start()
    } catch {
      setListening(false)
      onToast({ kind: 'error', message: 'No pude iniciar dictado.' })
    }
  }

  function startEdit(o: Schema['OrderPublic']['type']) {
    setEditingOrderId(o.orderId)
    setEditProduct(String(o.product ?? ''))
    setEditQuantity(String(o.quantity ?? ''))
    setEditUnit(String(o.unit ?? ''))
    setEditPickupDate(String(o.pickupDate ?? ''))
    setEditMunicipio(String(o.municipio ?? ''))
  }

  function cancelEdit() {
    setEditingOrderId(null)
    setEditProduct('')
    setEditQuantity('')
    setEditUnit('')
    setEditPickupDate('')
    setEditMunicipio('')
  }

  async function saveEdit() {
    if (!editingOrderId) return

    const product = editProduct.trim()
    const municipio = editMunicipio.trim()
    const qtyNum = Number(editQuantity.replace(',', '.'))
    if (!product) {
      onToast({ kind: 'error', message: 'Producto es requerido.' })
      return
    }
    if (!municipio) {
      onToast({ kind: 'error', message: 'Municipio es requerido.' })
      return
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      onToast({ kind: 'error', message: 'Cantidad inválida.' })
      return
    }

    if (!amplifyReady || !isOnline) {
      const op: OrderOp = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        kind: 'update',
        orderId: editingOrderId,
        patch: {
          product,
          quantity: qtyNum,
          unit: editUnit.trim() || undefined,
          pickupDate: editPickupDate.trim() || undefined,
          municipio,
        },
      }
      setOps((prev) => [op, ...prev])
      setMyOrders((prev) =>
        prev.map((o) =>
          o.orderId === editingOrderId
            ? {
                ...o,
                product,
                quantity: qtyNum,
                unit: editUnit.trim() || undefined,
                pickupDate: editPickupDate.trim() || undefined,
                municipio,
              }
            : o
        )
      )
      onToast({ kind: 'success', message: 'Editado en local; se sincroniza al volver online.' })
      cancelEdit()
      return
    }

    setEditBusy(true)
    try {
      const client = generateClient<Schema>()
      await client.mutations.updateOrderSecure({
        orderId: editingOrderId,
        product,
        quantity: qtyNum,
        unit: editUnit.trim() || undefined,
        pickupDate: editPickupDate.trim() || undefined,
        municipio,
      })
      onToast({ kind: 'success', message: 'Pedido actualizado.' })
      cancelEdit()
      await Promise.all([refreshMyOrders(), refreshPublicOrders()])
    } catch (e) {
      onToast({ kind: 'error', message: `No pude actualizar: ${getErrorMessage(e)}` })
    } finally {
      setEditBusy(false)
    }
  }

  async function updateStatus(orderId: string | null | undefined, status: string) {
    if (!orderId) return
    if (!amplifyReady || !isOnline) {
      const op: OrderOp = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        kind: 'status',
        orderId,
        status,
      }
      setOps((prev) => [op, ...prev])
      setMyOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId
            ? { ...o, status: status as Schema['OrderPublic']['type']['status'] }
            : o
        )
      )
      onToast({ kind: 'success', message: 'Estado guardado en local; se sincroniza al volver online.' })
      return
    }
    try {
      const client = generateClient<Schema>()
      await client.mutations.updateOrderStatusSecure({ orderId, status })
      onToast({ kind: 'success', message: 'Estado actualizado.' })
      await Promise.all([refreshMyOrders(), refreshPublicOrders()])
    } catch (e) {
      onToast({ kind: 'error', message: `No pude actualizar estado: ${getErrorMessage(e)}` })
    }
  }

  async function deleteRemote(orderId: string | null | undefined) {
    if (!orderId) return
    if (!amplifyReady || !isOnline) {
      const op: OrderOp = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        kind: 'delete',
        orderId,
      }
      setOps((prev) => [op, ...prev])
      setMyOrders((prev) => prev.filter((o) => o.orderId !== orderId))
      onToast({ kind: 'success', message: 'Eliminado en local; se sincroniza al volver online.' })
      return
    }
    try {
      const client = generateClient<Schema>()
      await client.mutations.deleteOrderSecure({ orderId })
      onToast({ kind: 'success', message: 'Pendiente eliminado en backend.' })
      await Promise.all([refreshMyOrders(), refreshPublicOrders()])
    } catch (e) {
      onToast({ kind: 'error', message: `No pude eliminar: ${getErrorMessage(e)}` })
    }
  }

  async function onRegister() {
    setError(null)
    setLastParsed(null)
    const text = rawText.trim()
    if (!text) {
      setError('Escribe (o dicta) un mensaje primero.')
      return
    }

    const parsed = await analyzeTextWithAI(text)
    if (!parsed) {
      setError('No pude extraer datos. Prueba con: “Tengo 30 bultos de cebolla para el viernes en Aquitania”.')
      return
    }
    setLastParsed(parsed)

    if (isOnline && amplifyReady) {
      try {
        const client = generateClient<Schema>()
        const aiAnalysis = JSON.stringify(parsed)
        await client.mutations.createOrderSecure({
          product: parsed.product,
          quantity: parsed.quantity,
          unit: parsed.unit,
          pickupDate: parsed.pickupDate,
          municipio: parsed.municipio,
          aiAnalysis,
        })
        onToast({ kind: 'success', message: 'Pendiente creado en el backend.' })
        await Promise.all([refreshMyOrders(), refreshPublicOrders()])
        return
      } catch (e) {
        // Si falla la escritura remota, caemos a cola offline.
        const msg = getErrorMessage(e)
        const hint = msg.toLowerCase().includes('municipio')
          ? ' (Revisa Configuración → Perfil y guarda tu municipio)'
          : ''
        onToast({ kind: 'info', message: `Backend falló; guardado offline. ${msg}${hint}` })
      }
    }

    setQueue((prev) => [
      {
        id: makeId(),
        createdAt: new Date().toISOString(),
        payload: { rawText: text, municipio: parsed.municipio },
      },
      ...prev,
    ])
    onToast({ kind: 'success', message: 'Guardado local (pendiente en cola).' })
  }

  function removeQueueItem(id: string) {
    setQueue((prev) => prev.filter((x) => x.id !== id))
    onToast({ kind: 'success', message: 'Eliminado de la cola local.' })
  }

  function editQueueItem(id: string) {
    const item = queue.find((x) => x.id === id)
    if (!item) return
    setRawText(item.payload.rawText)
    onToast({ kind: 'info', message: 'Edita el texto y vuelve a registrar.' })
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Conectividad" value={headerBadge.label} tone={isOnline ? 'good' : 'warn'} />
            <StatCard label="Backend" value={amplifyReady ? 'Listo' : 'Local'} tone={amplifyReady ? 'brand' : 'neutral'} />
            <StatCard label="Cola local" value={pendingCount} tone={pendingCount > 0 ? 'warn' : 'neutral'} />
            <StatCard label="Operaciones" value={pendingOpsCount} tone={pendingOpsCount > 0 ? 'warn' : 'neutral'} />
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <Card className={density === 'compact' ? 'p-3' : 'p-4'}>
            <CardHeader
              title="Registrar carga"
              subtitle="Escribe o dicta y se publica (offline-first con cola local)."
              right={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                    onClick={() => {
                      setNavIntent({
                        kind: 'createRequest',
                        type: 'SUPPORT',
                        title: 'Soporte: problema en Pendientes',
                        details: 'Describe qué estabas haciendo y qué error viste.',
                        goToAfterCreate: 'pendientes',
                      })
                      onNavigate?.('solicitudes')
                    }}
                    title="Crear solicitud de soporte"
                  >
                    Soporte
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm font-semibold disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                    disabled={listening}
                    onClick={startDictation}
                    title="Dictar"
                  >
                    {listening ? '…' : 'Voz'}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white active:scale-[0.99] dark:bg-emerald-500 dark:text-zinc-950"
                    onClick={onRegister}
                  >
                    Registrar
                  </button>
                </div>
              }
            />

            <div className="mt-4 flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">Perfil (MVP)</label>
              <select
                className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="PRODUCTOR">Productor</option>
                <option value="TRANSPORTISTA">Transportista</option>
              </select>
            </div>

            <textarea
              className="mt-3 w-full resize-none rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-sm leading-5 outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Ej: Tengo 30 bultos de cebolla para el viernes en Aquitania"
            />

            {error ? <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

            {lastParsed ? (
              <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                <div className="font-semibold">Datos extraídos</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-emerald-900/70">Producto:</span> {lastParsed.product}
                  </div>
                  <div>
                    <span className="text-emerald-900/70">Cantidad:</span> {lastParsed.quantity} {lastParsed.unit ?? ''}
                  </div>
                  <div className="col-span-2">
                    <span className="text-emerald-900/70">Municipio:</span> {lastParsed.municipio}
                  </div>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className={density === 'compact' ? 'p-3' : 'p-4'}>
            <CardHeader title="Cola local" subtitle="Pendientes guardados en este dispositivo." />
            <div className="mt-4 space-y-2">
              {queue.slice(0, 10).map((item) => {
                const parsed = safeParseJsonObject(item.payload.rawText)
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-zinc-200/70 bg-white/60 p-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold">{item.payload.municipio ?? '—'}</div>
                        <div className="mt-1 break-words text-zinc-700 dark:text-zinc-200">{item.payload.rawText}</div>
                        {parsed ? <div className="mt-2 text-xs text-zinc-500">JSON detectado en texto</div> : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                          onClick={() => editQueueItem(item.id)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                          onClick={() => removeQueueItem(item.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {queue.length === 0 ? <div className="text-sm text-zinc-600 dark:text-zinc-300">No hay pendientes locales.</div> : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-7">
          <Card className={density === 'compact' ? 'p-3' : 'p-4'}>
            <CardHeader
              title="Pendientes de tu municipio"
              subtitle="Se filtra server-side por tu municipio (claim o perfil sincronizado)."
              right={
                <button
                  type="button"
                  className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  disabled={publicBusy}
                  onClick={refreshPublicOrders}
                >
                  {publicBusy ? '…' : 'Actualizar'}
                </button>
              }
            />

            <div className="mt-4 space-y-2">
              {publicOrders.slice(0, 10).map((o, idx) => (
                <div
                  key={`${o.id ?? o.orderId ?? 'item'}-${idx}`}
                  className="rounded-2xl border border-zinc-200/70 bg-white/60 p-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {o.orderNumber != null ? `#${o.orderNumber} · ` : ''}
                        {o.product ?? '—'} · {o.quantity ?? '—'} {o.unit ?? ''}
                      </div>
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        {o.municipio ?? '—'} · {o.status ?? 'PENDIENTE'}
                      </div>
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        Publicado por: {o.createdByName ?? '—'}{o.createdByRole ? ` · ${o.createdByRole}` : ''}
                      </div>
                      {o.createdByVereda ? <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Vereda: {o.createdByVereda}</div> : null}
                      {o.createdByPhone ? (
                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                          Contacto:{' '}
                          <a className="font-semibold underline" href={`tel:${o.createdByPhone}`}>
                            {o.createdByPhone}
                          </a>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                        onClick={() => {
                          setNavIntent({
                            kind: 'consolidationFocus',
                            municipio: o.municipio ?? undefined,
                            product: o.product ?? undefined,
                            pickupDate: o.pickupDate ?? undefined,
                          })
                          onNavigate?.('consolidaciones')
                        }}
                      >
                        Consolidar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {publicOrders.length === 0 ? <div className="text-sm text-zinc-600 dark:text-zinc-300">Sin resultados.</div> : null}
            </div>
          </Card>

          <Card className={density === 'compact' ? 'p-3' : 'p-4'}>
            <CardHeader
              title="Mis pendientes publicados"
              subtitle="Actualiza estado, edita o elimina (offline-first con ops)."
              right={
                <button
                  type="button"
                  className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  disabled={myBusy}
                  onClick={refreshMyOrders}
                >
                  {myBusy ? '…' : 'Cargar'}
                </button>
              }
            />

            <div className="mt-4 space-y-2">
              {myOrders.slice(0, 10).map((o) => (
                <div
                  key={o.id}
                  className="rounded-2xl border border-zinc-200/70 bg-white/60 p-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {(o as unknown as { orderNumber?: number | null }).orderNumber != null
                          ? `#${(o as unknown as { orderNumber?: number | null }).orderNumber} · `
                          : ''}
                        {o.product} · {o.quantity} {o.unit ?? ''}
                      </div>
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{o.municipio} · {o.status ?? 'PENDIENTE'}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <select
                        className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs dark:border-zinc-800/60 dark:bg-zinc-950/40"
                        value={o.status ?? 'PENDIENTE'}
                        onChange={(e) => updateStatus(o.orderId, e.target.value)}
                      >
                        <option value="PENDIENTE">PENDIENTE</option>
                        <option value="CONSOLIDADO">CONSOLIDADO</option>
                        <option value="TRANSITO">TRANSITO</option>
                        <option value="ENTREGADO">ENTREGADO</option>
                      </select>
                      <button
                        type="button"
                        className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                        onClick={() => startEdit(o)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                        onClick={() => deleteRemote(o.orderId)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {editingOrderId === o.orderId ? (
                    <div className="mt-3 rounded-2xl border border-zinc-200/70 bg-white/70 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40">
                      <div className="grid grid-cols-1 gap-2">
                        <input
                          className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                          value={editProduct}
                          onChange={(e) => setEditProduct(e.target.value)}
                          placeholder="Producto"
                        />
                        <div className="flex gap-2">
                          <input
                            className="flex-1 rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                            placeholder="Cantidad"
                            inputMode="decimal"
                          />
                          <input
                            className="w-32 rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                            value={editUnit}
                            onChange={(e) => setEditUnit(e.target.value)}
                            placeholder="Unidad"
                          />
                        </div>
                        <input
                          className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                          value={editPickupDate}
                          onChange={(e) => setEditPickupDate(e.target.value)}
                          placeholder="PickupDate (YYYY-MM-DD)"
                        />
                        <input
                          className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                          value={editMunicipio}
                          onChange={(e) => setEditMunicipio(e.target.value)}
                          placeholder="Municipio"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                            onClick={cancelEdit}
                            disabled={editBusy}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
                            onClick={saveEdit}
                            disabled={editBusy}
                          >
                            {editBusy ? '…' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}

              {myOrders.length === 0 ? <div className="text-sm text-zinc-600 dark:text-zinc-300">Sin pendientes publicados.</div> : null}
            </div>
          </Card>
        </div>
      </div>
    </main>
  )
}
