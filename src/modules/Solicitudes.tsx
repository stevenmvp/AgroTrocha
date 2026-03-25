import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'
import { Card, CardHeader } from '../components/ui/Card'
import type { NavKey } from '../components/BottomNav'
import { getErrorMessage } from '../lib/getErrorMessage'
import { consumeNavIntent } from '../state/navIntent'

const TYPES: Array<NonNullable<Schema['Request']['type']['type']>> = [
  'ROLE_CHANGE',
  'PROVIDER_ONBOARDING',
  'SUPPORT',
  'DATA_FIX',
  'OTHER',
]

const STATUSES: Array<NonNullable<Schema['Request']['type']['status']>> = ['OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'DONE']

type RequestDraft = {
  type: (typeof TYPES)[number]
  title: string
  details?: string
  payloadJson?: string
}

type RequestQueueItem = {
  id: string
  createdAt: string
  payload: RequestDraft
}

const REQ_QUEUE_KEY = 'agrotrocha.requestQueue.v1'

function loadReqQueue(): RequestQueueItem[] {
  try {
    const raw = localStorage.getItem(REQ_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RequestQueueItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveReqQueue(queue: RequestQueueItem[]) {
  localStorage.setItem(REQ_QUEUE_KEY, JSON.stringify(queue))
}

function makeId() {
  return crypto.randomUUID()
}

export function SolicitudesModule({
  amplifyReady,
  isOnline,
  density,
  onToast,
  onNavigate,
}: {
  amplifyReady: boolean
  isOnline: boolean
  density: 'compact' | 'comfortable'
  onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void
  onNavigate?: (key: NavKey) => void
}) {
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Schema['Request']['type'][]>([])

  const [queue, setQueue] = useState<RequestQueueItem[]>(() => loadReqQueue())
  const [syncingQueue, setSyncingQueue] = useState(false)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | (typeof STATUSES)[number]>('ALL')
  const [typeFilter, setTypeFilter] = useState<'ALL' | (typeof TYPES)[number]>('ALL')

  const [type, setType] = useState<(typeof TYPES)[number]>('SUPPORT')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')

  const [goToAfterCreate, setGoToAfterCreate] = useState<NavKey | null>(null)

  const cardPad = density === 'compact' ? 'p-3' : 'p-4'
  const canUseBackend = useMemo(() => amplifyReady && isOnline, [amplifyReady, isOnline])

  useEffect(() => {
    const intent = consumeNavIntent()
    if (intent?.kind !== 'createRequest') return

    if (typeof intent.type === 'string' && TYPES.includes(intent.type as (typeof TYPES)[number])) {
      setType(intent.type as (typeof TYPES)[number])
    }
    if (typeof intent.title === 'string') setTitle(intent.title)
    if (typeof intent.details === 'string') setDetails(intent.details)
    if (intent.goToAfterCreate) setGoToAfterCreate(intent.goToAfterCreate)
  }, [])

  useEffect(() => {
    saveReqQueue(queue)
  }, [queue])

  useEffect(() => {
    if (!canUseBackend) return
    if (syncingQueue) return
    if (queue.length === 0) return

    let cancelled = false
    setSyncingQueue(true)
    ;(async () => {
      try {
        const client = generateClient<Schema>()
        const toSend = queue.slice(0, 10)
        for (const item of toSend) {
          await client.mutations.createRequestSecure({
            type: item.payload.type,
            title: item.payload.title,
            details: item.payload.details,
            payloadJson: item.payload.payloadJson,
          })
          if (cancelled) return
          setQueue((prev) => prev.filter((x) => x.id !== item.id))
        }
      } catch {
        // keep queue; retry later
      } finally {
        if (!cancelled) setSyncingQueue(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canUseBackend, syncingQueue, queue])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return (items ?? []).filter((r) => {
      if (statusFilter !== 'ALL' && (r.status ?? 'OPEN') !== statusFilter) return false
      if (typeFilter !== 'ALL' && (r.type ?? 'OTHER') !== typeFilter) return false
      if (!query) return true
      const hay = `${r.title ?? ''} ${r.details ?? ''} ${r.type ?? ''} ${r.status ?? ''}`.toLowerCase()
      return hay.includes(query)
    })
  }, [items, q, statusFilter, typeFilter])

  async function refreshMine() {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const current = await getCurrentUser()
      const client = generateClient<Schema>()
      const res = await client.models.Request.listRequestsByCreator({ createdByUserId: current.userId })
      setItems(res.data ?? [])
    } catch (e) {
      onToast({ kind: 'error', message: `No pude cargar tus solicitudes: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    const t = title.trim()
    const d = details.trim()
    if (!t) {
      onToast({ kind: 'error', message: 'Título es requerido.' })
      return
    }
    if (!canUseBackend) {
      const item: RequestQueueItem = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        payload: { type, title: t, details: d || undefined, payloadJson: undefined },
      }
      setQueue((prev) => [item, ...prev])
      setTitle('')
      setDetails('')
      onToast({ kind: 'info', message: 'Offline: solicitud guardada en cola y se enviará cuando haya conexión.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      await client.mutations.createRequestSecure({
        type,
        title: t,
        details: d || undefined,
        payloadJson: undefined,
      })
      setTitle('')
      setDetails('')
      onToast({ kind: 'success', message: 'Solicitud creada.' })
      await refreshMine()
      if (goToAfterCreate && onNavigate) onNavigate(goToAfterCreate)
      setGoToAfterCreate(null)
    } catch (e) {
      onToast({ kind: 'error', message: `No pude crear solicitud: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className={cardPad}>
          <CardHeader
            title="Mis solicitudes"
            subtitle="Seguimiento de casos: soporte, cambios, correcciones."
            right={
              <button
                type="button"
                className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                onClick={refreshMine}
                disabled={busy}
              >
                {busy ? 'Cargando…' : 'Actualizar'}
              </button>
            }
          />

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40 md:col-span-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar (título / detalle)…"
            />
            <select
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="ALL">Estado: Todos</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            >
              <option value="ALL">Tipo: Todos</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 space-y-2">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-zinc-200/70 bg-white/60 p-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">{r.status ?? 'OPEN'}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  {typeof (r as unknown as { requestNumber?: unknown }).requestNumber === 'number'
                    ? `#${(r as unknown as { requestNumber: number }).requestNumber} · `
                    : ''}
                  Tipo: {r.type ?? 'OTHER'}
                </div>
                {r.details ? <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{r.details}</div> : null}
              </div>
            ))}
            {filtered.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Aún no tienes solicitudes.</div>
            ) : null}
          </div>

          <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
            Estados: {STATUSES.join(' · ')}
          </div>
        </Card>

        <Card className={cardPad}>
          <CardHeader title="Crear solicitud" subtitle={goToAfterCreate ? `Al crear: volver a ${goToAfterCreate}.` : undefined} />

          <div className="mt-3 grid grid-cols-1 gap-3">
            <label className="text-sm">
              <div className="mb-1 font-medium">Tipo</div>
              <select
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={type}
                onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Título</div>
              <input
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Necesito cambiar mi rol"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Detalles (opcional)</div>
              <textarea
                className="min-h-[96px] w-full resize-none rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe el caso para que te ayuden más rápido."
              />
            </label>

            <button
              type="button"
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
              onClick={create}
              disabled={busy}
            >
              {busy ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </Card>
      </div>
    </main>
  )
}
