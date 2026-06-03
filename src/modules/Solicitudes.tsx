import { useEffect, useMemo, useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { Schema } from '../../amplify/data/resource'

type RequestItem = {
  id: string
  createdAt: string
  type: 'SUPPORT' | 'ROLE_CHANGE' | 'DATA_FIX' | 'OTHER'
  title: string
  details: string
  status: 'OPEN' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'DONE'
  sent: boolean
}

const STORAGE_KEY = 'agrotrocha.requests.v1'
const REQUEST_TYPES: RequestItem['type'][] = ['SUPPORT', 'ROLE_CHANGE', 'DATA_FIX', 'OTHER']

function loadRequests(): RequestItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RequestItem[]
    return Array.isArray(parsed)
      ? parsed.map((item) => ({
          ...item,
          type: REQUEST_TYPES.includes(item.type) ? item.type : 'SUPPORT',
          status: ['OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'DONE'].includes(item.status)
            ? item.status
            : 'OPEN',
        }))
      : []
  } catch {
    return []
  }
}

function saveRequests(requests: RequestItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
}

type SolicitudesModuleProps = {
  amplifyReady: boolean
  isOnline: boolean
  onToast: (toast: { kind: 'success' | 'error' | 'info'; message: string }) => void
}

export function SolicitudesModule({ amplifyReady, isOnline, onToast }: SolicitudesModuleProps) {
  const [requests, setRequests] = useState<RequestItem[]>(() => loadRequests())
  const [type, setType] = useState<RequestItem['type']>('SUPPORT')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const canSync = amplifyReady && isOnline
  const pendingQueue = requests.filter((request) => !request.sent)

  useEffect(() => {
    saveRequests(requests)
  }, [requests])

  const statusSummary = useMemo(() => {
    const open = requests.filter((item) => item.status === 'OPEN').length
    const approved = requests.filter((item) => item.status === 'APPROVED').length
    const rejected = requests.filter((item) => item.status === 'REJECTED').length
    return `${open} abierto · ${approved} aprobadas · ${rejected} rechazadas`
  }, [requests])

  async function createRequest() {
    const nextTitle = title.trim()
    if (!nextTitle) {
      onToast({ kind: 'error', message: 'El título es obligatorio.' })
      return
    }

    const request: RequestItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      type,
      title: nextTitle,
      details: details.trim(),
      status: 'OPEN',
      sent: false,
    }

    setRequests((prev) => [request, ...prev])
    setTitle('')
    setDetails('')

    if (!canSync) {
      onToast({ kind: 'info', message: 'Solicitud guardada localmente y se enviará cuando haya conexión.' })
      return
    }

    await sendRequestToBackend(request)
  }

  async function sendRequestToBackend(request: RequestItem) {
    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const body = {
        type: request.type,
        title: request.title,
        details: request.details || undefined,
        payloadJson: undefined,
      }
      await client.mutations.createRequestSecure(body)
      setRequests((prev) => prev.map((item) => (item.id === request.id ? { ...item, sent: true } : item)))
      onToast({ kind: 'success', message: 'Solicitud enviada al backend.' })
    } catch {
      onToast({ kind: 'error', message: 'No se pudo enviar la solicitud al backend. Queda en cola.' })
    } finally {
      setBusy(false)
    }
  }

  async function syncQueue() {
    if (!canSync) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    const queue = pendingQueue.slice(0, 10)
    if (queue.length === 0) {
      onToast({ kind: 'info', message: 'No hay solicitudes pendientes en cola.' })
      return
    }

    setBusy(true)
    try {
      for (const request of queue) {
        await sendRequestToBackend(request)
      }
    } finally {
      setBusy(false)
    }
  }

  function updateStatus(id: string, nextStatus: RequestItem['status']) {
    setRequests((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)))
    onToast({ kind: 'success', message: `Solicitud marcada como ${nextStatus.toLowerCase()}.` })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
        <div className="flex flex-col gap-2">
          <div className="text-xl font-semibold">Solicitudes</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Crea solicitudes, guárdalas en modo offline y envíalas cuando tengas conexión.
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block">
              <div className="text-sm font-semibold">Tipo</div>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as RequestItem['type'])}
                className="mt-2 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              >
                {REQUEST_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="text-sm font-semibold">Estado</div>
            <div className="mt-2 rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-3 py-3 text-sm text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-200">
              {statusSummary}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <div className="text-sm font-semibold">Título</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descripción breve"
              className="mt-2 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold">Detalles</div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="Información adicional"
              className="mt-2 w-full resize-none rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={busy}
              onClick={createRequest}
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-emerald-500 dark:text-zinc-950"
            >
              {busy ? 'Procesando…' : 'Crear solicitud'}
            </button>
            <button
              type="button"
              disabled={!canSync || busy}
              onClick={syncQueue}
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-200"
            >
              Enviar cola ({pendingQueue.length})
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
        <div className="flex flex-col gap-2">
          <div className="text-xl font-semibold">Lista de solicitudes</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Revisa las solicitudes guardadas y cambia su estado localmente.
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/20 dark:text-zinc-300">
              No hay solicitudes registradas aún.
            </div>
          ) : (
            requests.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-zinc-200/70 bg-white/80 p-4 text-sm shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-base font-semibold">{request.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
                      {request.type} · {request.status} · {request.sent ? 'Enviado' : 'Pendiente'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-2xl border border-emerald-600 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                      onClick={() => updateStatus(request.id, 'APPROVED')}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-rose-600 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      onClick={() => updateStatus(request.id, 'REJECTED')}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
                {request.details ? <div className="mt-3 text-zinc-700 dark:text-zinc-300">{request.details}</div> : null}
                <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Creada: {new Date(request.createdAt).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
