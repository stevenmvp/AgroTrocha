import { useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'

export function NotificacionesModule({
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
  const [items, setItems] = useState<Schema['Notification']['type'][]>([])

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  const cardPad = density === 'compact' ? 'p-3' : 'p-4'
  const canUseBackend = useMemo(() => amplifyReady && isOnline, [amplifyReady, isOnline])

  async function refreshMine() {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const current = await getCurrentUser()
      const client = generateClient<Schema>()
      const res = await client.models.Notification.listNotificationsByUser({ userId: current.userId })
      setItems(res.data ?? [])
    } catch {
      onToast({ kind: 'error', message: 'No pude cargar notificaciones.' })
    } finally {
      setBusy(false)
    }
  }

  async function createSelf() {
    const t = title.trim()
    if (!t) {
      onToast({ kind: 'error', message: 'Título es requerido.' })
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
      await client.models.Notification.create({
        userId: current.userId,
        title: t,
        message: message.trim() || undefined,
        read: false,
      })
      setTitle('')
      setMessage('')
      onToast({ kind: 'success', message: 'Notificación creada.' })
      await refreshMine()
    } catch {
      onToast({ kind: 'error', message: 'No pude crear notificación.' })
    } finally {
      setBusy(false)
    }
  }

  async function toggleRead(n: Schema['Notification']['type']) {
    if (!canUseBackend) return
    if (!n.id) return

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      await client.models.Notification.update({
        id: n.id,
        read: !(n.read ?? false),
      })
      await refreshMine()
    } catch {
      onToast({ kind: 'error', message: 'No pude actualizar notificación.' })
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
              <h2 className="text-base font-semibold">Notificaciones</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Mensajes para ti (cambios de estado, recordatorios, etc.).</p>
            </div>
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold dark:bg-slate-950 dark:border-slate-800"
              onClick={refreshMine}
              disabled={busy}
            >
              {busy ? 'Cargando…' : 'Actualizar'}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {items.map((n) => (
              <div
                key={n.id}
                className={
                  'rounded-2xl border p-3 text-sm dark:border-slate-800 ' +
                  (n.read ? 'bg-slate-50 dark:bg-slate-950' : 'bg-emerald-50 dark:bg-slate-950')
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">{n.title}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">{n.read ? 'Leída' : 'Nueva'}</div>
                </div>
                {n.message ? <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{n.message}</div> : null}

                <div className="mt-3">
                  <button
                    type="button"
                    className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold dark:bg-slate-950 dark:border-slate-800"
                    onClick={() => void toggleRead(n)}
                    disabled={busy}
                  >
                    {n.read ? 'Marcar como nueva' : 'Marcar como leída'}
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-300">No tienes notificaciones.</div>
            ) : null}
          </div>
        </section>

        <section className={`rounded-2xl border bg-white shadow-sm dark:bg-slate-900 ${cardPad}`}>
          <h2 className="text-base font-semibold">Crear (prueba)</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">MVP: permite auto-notificación para validar el flujo.</p>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <label className="text-sm">
              <div className="mb-1 font-medium">Título</div>
              <input
                className="w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-950 dark:border-slate-800"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Recordatorio"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Mensaje (opcional)</div>
              <textarea
                className="min-h-[96px] w-full resize-none rounded-2xl border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-950 dark:border-slate-800"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ej: Revisar pendientes de hoy."
              />
            </label>

            <button
              type="button"
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900"
              onClick={createSelf}
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
