import { useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'

const SEVERITIES: Array<NonNullable<Schema['Alert']['type']['severity']>> = ['INFO', 'WARNING', 'CRITICAL']

export function AlertasModule({
  amplifyReady,
  isOnline,
  density,
  onToast,
}: {
  amplifyReady: boolean
  isOnline: boolean
  density: 'compact' | 'comfortable'
  onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void
}) {
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Schema['Alert']['type'][]>([])

  const [filterMunicipio, setFilterMunicipio] = useState('')

  const [municipio, setMunicipio] = useState('')
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('WARNING')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  const cardPad = density === 'compact' ? 'p-3' : 'p-4'
  const canUseBackend = useMemo(() => amplifyReady && isOnline, [amplifyReady, isOnline])

  async function refresh() {
    const m = filterMunicipio.trim() || municipio.trim()
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }
    if (!m) {
      onToast({ kind: 'info', message: 'Escribe un municipio para listar alertas.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const res = await client.models.Alert.listAlertsByMunicipio({ municipio: m })
      setItems(res.data ?? [])
    } catch {
      onToast({ kind: 'error', message: 'No pude cargar alertas.' })
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    const t = title.trim()
    const m = municipio.trim()
    if (!t) {
      onToast({ kind: 'error', message: 'Título es requerido.' })
      return
    }
    if (!m) {
      onToast({ kind: 'error', message: 'Municipio es requerido.' })
      return
    }
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const current = await getCurrentUser()
      const client = generateClient<Schema>()
      await client.models.Alert.create({
        createdByUserId: current.userId,
        municipio: m,
        severity,
        status: 'OPEN',
        title: t,
        message: message.trim() || undefined,
      })
      setTitle('')
      setMessage('')
      onToast({ kind: 'success', message: 'Alerta creada.' })
      await refresh()
    } catch {
      onToast({ kind: 'error', message: 'No pude crear alerta.' })
    } finally {
      setBusy(false)
    }
  }

  async function ack(alert: Schema['Alert']['type']) {
    if (!canUseBackend) return
    if (!alert.id) return

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      await client.models.Alert.update({
        id: alert.id,
        status: alert.status === 'ACK' ? 'OPEN' : 'ACK',
      })
      await refresh()
    } catch {
      onToast({ kind: 'error', message: 'No pude actualizar alerta.' })
    } finally {
      setBusy(false)
    }
  }

  async function close(alert: Schema['Alert']['type']) {
    if (!canUseBackend) return
    if (!alert.id) return

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      await client.models.Alert.update({
        id: alert.id,
        status: 'CLOSED',
      })
      await refresh()
    } catch {
      onToast({ kind: 'error', message: 'No pude cerrar alerta.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-4 md:max-w-6xl">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className={`rounded-2xl border bg-white shadow-sm dark:bg-slate-900 ${cardPad}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Alertas</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Incidentes operativos (carretera, clima, bloqueos, etc.).</p>
            </div>
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold dark:bg-slate-950 dark:border-slate-800"
              onClick={refresh}
              disabled={busy}
            >
              {busy ? 'Cargando…' : 'Actualizar'}
            </button>
          </div>

          <label className="mt-3 block text-sm">
            <div className="mb-1 font-medium">Municipio (para listar)</div>
            <input
              className="w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-950 dark:border-slate-800"
              value={filterMunicipio}
              onChange={(e) => setFilterMunicipio(e.target.value)}
              placeholder="Ej: Aquitania"
            />
          </label>

          <div className="mt-3 space-y-2">
            {items.map((a) => (
              <div key={a.id} className="rounded-2xl border bg-slate-50 p-3 text-sm dark:bg-slate-950 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">{a.status ?? 'OPEN'}</div>
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {a.municipio ? `Municipio: ${a.municipio}` : 'Sin municipio'}
                  {a.severity ? ` · Severidad: ${a.severity}` : ''}
                </div>
                {a.message ? <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{a.message}</div> : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold dark:bg-slate-950 dark:border-slate-800"
                    onClick={() => void ack(a)}
                    disabled={busy}
                  >
                    {a.status === 'ACK' ? 'Reabrir' : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold dark:bg-slate-950 dark:border-slate-800"
                    onClick={() => void close(a)}
                    disabled={busy}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-300">No hay alertas para ese municipio.</div>
            ) : null}
          </div>
        </section>

        <section className={`rounded-2xl border bg-white shadow-sm dark:bg-slate-900 ${cardPad}`}>
          <h2 className="text-base font-semibold">Crear alerta</h2>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <label className="text-sm">
              <div className="mb-1 font-medium">Municipio</div>
              <input
                className="w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-950 dark:border-slate-800"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                placeholder="Ej: Aquitania"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Severidad</div>
              <select
                className="w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-950 dark:border-slate-800"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number])}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Título</div>
              <input
                className="w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-950 dark:border-slate-800"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Vía cerrada por derrumbe"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Mensaje (opcional)</div>
              <textarea
                className="min-h-[96px] w-full resize-none rounded-2xl border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-950 dark:border-slate-800"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Detalle: ubicación, hora, recomendaciones."
              />
            </label>

            <button
              type="button"
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
              onClick={create}
              disabled={busy}
            >
              {busy ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
