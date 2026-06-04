import { useEffect, useMemo, useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { Schema } from '../amplify/data/resource'
import { Toast, type ToastState } from './components/Toast'
import { ConfigModule } from './modules/Config'
import { PerfilModule, loadProfile } from './modules/Perfil'
import { SolicitudesModule } from './modules/Solicitudes'
import { PeticionesModule } from './modules/Peticiones'
import { IAModule } from './modules/IA'
import { SipsaModule } from './modules/SIPSA'
import { loadSettings, saveSettings, type Settings } from './state/settings'

type Page = 'perfil' | 'peticiones' | 'viajes' | 'alertas' | 'ia' | 'sipsa' | 'solicitudes' | 'config'

type NotificationItem = Schema['Notification']['type']

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  )
}

type AppProps = {
  amplifyReady: boolean
  auth?: {
    username: string | null
    signOut: (() => void) | null
  }
}

export default function App({ amplifyReady, auth }: AppProps) {
  const [page, setPage] = useState<Page>('perfil')
  const [toast, setToast] = useState<ToastState>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsBusy, setNotificationsBusy] = useState(false)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)

  const profile = loadProfile()

  const canFetchNotifications = amplifyReady && isOnline && Boolean(auth?.username)

  const statusBadge = useMemo(() => {
    return isOnline ? { label: 'Online', className: 'bg-emerald-100 text-emerald-900' } : { label: 'Offline', className: 'bg-amber-100 text-amber-900' }
  }, [isOnline])

  const backendBadge = useMemo(() => {
    return amplifyReady ? { label: 'Backend', className: 'bg-emerald-50 text-emerald-900' } : { label: 'Local', className: 'bg-zinc-100 text-zinc-700' }
  }, [amplifyReady])

  const unread = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications])

  useEffect(() => {
    const loadNotifications = async () => {
      if (!canFetchNotifications) return
      setNotificationsBusy(true)
      setNotificationsError(null)

      try {
        const client = generateClient<Schema>()
        const response = await client.models.Notification.listNotificationsByUser({ userId: auth?.username ?? '' })
        const payload = response?.data ?? response
        const list = Array.isArray(payload) ? payload : ([] as NotificationItem[])
        setNotifications(list)
      } catch (error) {
        console.warn('Failed to load notifications', error)
        setNotificationsError('No se pudieron cargar las notificaciones.')
      } finally {
        setNotificationsBusy(false)
      }
    }

    if (notificationsOpen) {
      void loadNotifications()
    }
  }, [notificationsOpen, canFetchNotifications, auth?.username])

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  function updateSettings(next: Settings) {
    setSettings(next)
    saveSettings(next)
    setToast({ kind: 'success', message: 'Configuracion guardada.' })
  }

  const navItems = [
    { id: 'perfil', label: 'Perfil', roles: ['PRODUCTOR', 'TRANSPORTISTA'] },
    { id: 'peticiones', label: 'Peticiones', roles: ['PRODUCTOR', 'TRANSPORTISTA'] },
    { id: 'viajes', label: 'Mis Viajes', roles: ['TRANSPORTISTA'] },
    { id: 'alertas', label: 'Alertas', roles: ['PRODUCTOR', 'TRANSPORTISTA'] },
    { id: 'ia', label: 'IA (Extraer)', roles: ['PRODUCTOR'] },
    { id: 'sipsa', label: 'Precios', roles: ['PRODUCTOR', 'TRANSPORTISTA'] },
    { id: 'solicitudes', label: 'Soporte', roles: ['PRODUCTOR', 'TRANSPORTISTA'] },
    { id: 'config', label: 'Config', roles: ['PRODUCTOR', 'TRANSPORTISTA'] },
  ]

  const visibleNavItems = navItems.filter((item) => item.roles.includes(profile.role))

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <Toast toast={toast} onClear={() => setToast(null)} />
      <header className="border-b border-zinc-200/70 bg-white/70 px-4 py-4 shadow-sm sticky top-0 z-10 dark:border-zinc-800/60 dark:bg-zinc-950/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">AgroTrocha</div>
              <div className="hidden rounded-full bg-zinc-200/50 px-2 py-0.5 text-xs font-semibold text-zinc-500 sm:inline-block">{profile.role}</div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`hidden rounded-full px-2 py-1 text-xs font-medium md:inline ${statusBadge.className}`}>{statusBadge.label}</span>
              <span className={`hidden rounded-full px-2 py-1 text-xs font-medium md:inline ${backendBadge.className}`}>{backendBadge.label}</span>

              <div className="relative">
                <button
                  type="button"
                  className="relative rounded-xl border border-zinc-200/70 bg-white/70 p-2 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  aria-label="Notificaciones"
                >
                  <BellIcon className="h-5 w-5" />
                  {unread > 0 ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white dark:bg-emerald-500 dark:text-zinc-950">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <div className="absolute right-0 z-20 mt-2 w-[320px] rounded-2xl border border-zinc-200/70 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-950/70">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Notificaciones</div>
                      <button
                        type="button"
                        className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                        onClick={() => setNotificationsOpen(false)}
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {!amplifyReady ? (
                        <div className="text-sm text-zinc-600 dark:text-zinc-300">Backend no disponible: sin notificaciones.</div>
                      ) : !isOnline ? (
                        <div className="text-sm text-zinc-600 dark:text-zinc-300">Offline: no se pueden cargar.</div>
                      ) : notificationsBusy ? (
                        <div className="text-sm text-zinc-600 dark:text-zinc-300">Cargando…</div>
                      ) : notificationsError ? (
                        <div className="text-sm text-rose-600">{notificationsError}</div>
                      ) : notifications.length === 0 ? (
                        <div className="text-sm text-zinc-600 dark:text-zinc-300">No tienes notificaciones.</div>
                      ) : (
                        notifications
                          .slice()
                          .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
                          .slice(0, 5)
                          .map((notification) => (
                            <div key={notification.id} className="rounded-2xl border border-zinc-200/70 p-3 text-sm dark:border-zinc-800/60">
                              <div className="font-semibold">{notification.title}</div>
                              {notification.message ? <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{notification.message}</div> : null}
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate([30])
                  setPage(item.id as Page)
                }}
                className={
                  'rounded-2xl px-4 py-2 text-sm font-semibold transition ' +
                  (page === item.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-zinc-200/70 bg-white/80 text-zinc-800 hover:border-emerald-500 hover:text-emerald-700 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-200')
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {page === 'perfil' ? (
          <PerfilModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            username={auth?.username ?? null}
            onToast={(next) => setToast(next)}
          />
        ) : null}

        {page === 'peticiones' ? (
          <PeticionesModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            username={auth?.username ?? null}
            onToast={(next) => setToast(next)}
          />
        ) : null}

        {page === 'ia' ? (
          <IAModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            sttEnabled={settings.sttEnabled}
            ttsEnabled={settings.ttsEnabled}
            onToast={(next) => setToast(next)}
          />
        ) : null}

        {page === 'sipsa' ? (
          <SipsaModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            density={settings.density}
            onToast={(next) => setToast(next)}
          />
        ) : null}

        {page === 'solicitudes' ? (
          <SolicitudesModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            username={auth?.username ?? null}
            onToast={(next) => setToast(next)}
          />
        ) : null}

        {page === 'viajes' ? (
          <div className="rounded-3xl border border-zinc-200/70 bg-white/70 p-6 text-center text-zinc-500">
             M�dulo de Mis Viajes en construcci�n...
          </div>
        ) : null}

        {page === 'alertas' ? (
          <div className="rounded-3xl border border-zinc-200/70 bg-white/70 p-6 text-center text-zinc-500">
             M�dulo de Alertas Comunitarias en construcci�n...
          </div>
        ) : null}

        {page === 'config' ? (
          <ConfigModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            username={auth?.username ?? null}
            density={settings.density}
            theme={settings.theme}
            sttEnabled={settings.sttEnabled}
            ttsEnabled={settings.ttsEnabled}
            onChangeDensity={(next) => updateSettings({ ...settings, density: next })}
            onChangeTheme={(next) => updateSettings({ ...settings, theme: next })}
            onChangeStt={(next) => updateSettings({ ...settings, sttEnabled: next })}
            onChangeTts={(next) => updateSettings({ ...settings, ttsEnabled: next })}
            signOut={auth?.signOut ?? null}
            onToast={(next) => setToast(next)}
          />
        ) : null}
      </main>
    </div>
  )
}
