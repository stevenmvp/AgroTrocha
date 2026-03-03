import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function TopBar({
  title,
  isOnline,
  amplifyReady,
  username,
  onOpenSidebar,
  onGoNotifications,
}: {
  title: string
  isOnline: boolean
  amplifyReady: boolean
  username: string | null
  onOpenSidebar: () => void
  onGoNotifications: () => void
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Schema['Notification']['type'][]>([])
  const [busy, setBusy] = useState(false)

  const statusBadge = useMemo(() => {
    if (!isOnline) return { label: 'Offline', className: 'bg-amber-100 text-amber-900' }
    return { label: 'Online', className: 'bg-emerald-100 text-emerald-900' }
  }, [isOnline])

  const backendBadge = useMemo(() => {
    if (amplifyReady) return { label: 'Backend', className: 'bg-emerald-50 text-emerald-900' }
    return { label: 'Local', className: 'bg-zinc-100 text-zinc-700' }
  }, [amplifyReady])

  const unread = useMemo(() => items.filter((n) => !(n.read ?? false)).length, [items])

  useEffect(() => {
    if (!open) return
    if (!amplifyReady || !isOnline) return

    let cancelled = false
    ;(async () => {
      setBusy(true)
      try {
        const current = await getCurrentUser()
        const client = generateClient<Schema>()
        const res = await client.models.Notification.listNotificationsByUser({ userId: current.userId })
        if (cancelled) return
        setItems(res.data ?? [])
      } catch {
        if (cancelled) return
        setItems([])
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, amplifyReady, isOnline])

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/70 backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-950/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-zinc-200/70 bg-white/70 p-2 dark:border-zinc-800/60 dark:bg-zinc-950/40 md:hidden"
            onClick={onOpenSidebar}
            aria-label="Abrir menú"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold md:text-base">{title}</div>
            <div className="truncate text-xs text-zinc-600 dark:text-zinc-300">AgroTrocha{username ? ` · ${username}` : ''}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`hidden rounded-full px-2 py-1 text-xs font-medium md:inline ${statusBadge.className}`}>{statusBadge.label}</span>
          <span className={`hidden rounded-full px-2 py-1 text-xs font-medium md:inline ${backendBadge.className}`}>{backendBadge.label}</span>

          <div className="relative">
            <button
              type="button"
              className="relative rounded-xl border border-zinc-200/70 bg-white/70 p-2 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              onClick={() => setOpen((v) => !v)}
              aria-label="Notificaciones"
            >
              <BellIcon className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white dark:bg-emerald-500 dark:text-zinc-950">
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </button>

            {open ? (
              <div className="absolute right-0 mt-2 w-[320px] rounded-2xl border border-zinc-200/70 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-950/70">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Notificaciones</div>
                  <button
                    type="button"
                    className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                    onClick={() => {
                      setOpen(false)
                      onGoNotifications()
                    }}
                  >
                    Ver todo
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {!amplifyReady ? (
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">Backend no disponible: sin notificaciones.</div>
                  ) : !isOnline ? (
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">Offline: no se pueden cargar.</div>
                  ) : busy ? (
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">Cargando…</div>
                  ) : items.length === 0 ? (
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">No tienes notificaciones.</div>
                  ) : (
                    items
                      .slice()
                      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
                      .slice(0, 5)
                      .map((n) => (
                        <div
                          key={n.id}
                          className={
                            'rounded-2xl border border-zinc-200/70 p-3 text-sm dark:border-zinc-800/60 ' +
                            (n.read ? 'bg-zinc-50/70 dark:bg-zinc-950/30' : 'bg-emerald-50/70 dark:bg-zinc-950/30')
                          }
                        >
                          <div className="font-semibold">{n.title}</div>
                          {n.message ? <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{n.message}</div> : null}
                        </div>
                      ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
