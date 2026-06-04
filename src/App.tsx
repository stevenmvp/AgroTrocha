import { useEffect, useState } from 'react'
import { Toast, type ToastState } from './components/Toast'
import { ConfigModule } from './modules/Config'
import { PerfilModule, loadProfile } from './modules/Perfil'
import { SolicitudesModule } from './modules/Solicitudes'
import { PeticionesModule } from './modules/Peticiones'
import { IAModule } from './modules/IA'
import { SipsaModule } from './modules/SIPSA'
import { loadSettings, saveSettings, type Settings } from './state/settings'

type Page = 'perfil' | 'peticiones' | 'viajes' | 'alertas' | 'ia' | 'sipsa' | 'solicitudes' | 'config'

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

  const profile = loadProfile()

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
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
              AgroTrocha
            </div>
            <div className="sm:hidden text-xs font-semibold text-zinc-500 bg-zinc-200/50 px-2 py-0.5 rounded-full">
              {profile.role}
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
             Módulo de Mis Viajes en construcción...
          </div>
        ) : null}

        {page === 'alertas' ? (
          <div className="rounded-3xl border border-zinc-200/70 bg-white/70 p-6 text-center text-zinc-500">
             Módulo de Alertas Comunitarias en construcción...
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
