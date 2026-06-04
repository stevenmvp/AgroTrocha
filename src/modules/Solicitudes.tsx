import { useState } from 'react'

type SolicitudesModuleProps = {
  amplifyReady: boolean
  isOnline: boolean
  username?: string | null
  onToast: (toast: { kind: 'success' | 'error' | 'info'; message: string }) => void
}

type Solicitud = {
  id: string
  title: string
  details?: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
  createdAt: string
  createdBy?: string
}

const DEFAULT_SOLICITUDES: Solicitud[] = [
  {
    id: 'sol-001',
    title: 'Error al sincronizar petición',
    details: 'La petición de arroz no se sincroniza correctamente con el servidor',
    status: 'IN_PROGRESS',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'usr-prod-1',
  },
  {
    id: 'sol-002',
    title: 'Dashboard no muestra datos remotos',
    details: 'El contador de órdenes remotas siempre está en blanco',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'usr-prod-2',
  },
  {
    id: 'sol-003',
    title: 'Preguntas sobre consolidación',
    details: '¿Cómo funciona el motor de consolidación de órdenes?',
    status: 'RESOLVED',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'usr-prod-3',
  },
  {
    id: 'sol-004',
    title: 'Solicitud de feature: notificaciones push',
    details: 'Necesitamos notificaciones cuando una orden es consolidada',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'usr-trans-1',
  },
]

export function SolicitudesModule({ onToast }: SolicitudesModuleProps) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>(DEFAULT_SOLICITUDES)
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendSupport() {
    if (!title.trim()) return onToast({ kind: 'error', message: 'Título requerido.' })
    setBusy(true)
    try {
      const newSol: Solicitud = {
        id: `sol-${Date.now()}`,
        title: title.trim(),
        details: details.trim() || undefined,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        createdBy: 'current-user',
      }
      setSolicitudes([newSol, ...solicitudes])
      setTitle('')
      setDetails('')
      onToast({ kind: 'success', message: 'Solicitud registrada.' })
    } catch (e) {
      console.warn('support send failed', e)
      onToast({ kind: 'error', message: 'No se pudo enviar la solicitud técnica.' })
    } finally {
      setBusy(false)
    }
  }

  const statusBadge = (status: string) => {
    const classes =
      status === 'OPEN'
        ? 'bg-amber-100 text-amber-900'
        : status === 'IN_PROGRESS'
          ? 'bg-blue-100 text-blue-900'
          : 'bg-emerald-100 text-emerald-900'
    return classes
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border p-6 bg-white/70">
        <div className="text-xl font-semibold">Reportar solicitud</div>
        <div className="text-sm text-zinc-600">Reporta problemas técnicos o solicita nuevas funcionalidades.</div>

        <div className="mt-4 space-y-3">
          <input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-2xl border px-3 py-2 w-full" />
          <textarea placeholder="Detalles" value={details} onChange={(e) => setDetails(e.target.value)} className="rounded-2xl border px-3 py-2 w-full" rows={4} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={sendSupport} className="rounded-2xl bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">
              {busy ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border p-6 bg-white/70">
        <div className="text-xl font-semibold mb-4">Solicitudes recientes</div>
        <div className="space-y-3">
          {solicitudes.length === 0 ? (
            <div className="text-center text-zinc-500">No hay solicitudes registradas.</div>
          ) : (
            solicitudes.map((sol) => (
              <div key={sol.id} className="rounded-2xl border p-4 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{sol.title}</div>
                    {sol.details && <div className="text-xs text-zinc-600 mt-1">{sol.details}</div>}
                    <div className="text-xs text-zinc-500 mt-2">Por {sol.createdBy} · {new Date(sol.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ${statusBadge(sol.status)}`}>{sol.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

