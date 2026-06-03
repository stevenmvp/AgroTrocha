import { useEffect, useState } from 'react'
import { Toast, type ToastState } from './components/Toast'
import { ConfigModule } from './modules/Config'
import { PerfilModule } from './modules/Perfil'
import { SolicitudesModule } from './modules/Solicitudes'
import { PeticionesModule } from './modules/Peticiones'
import { loadSettings, saveSettings, type Settings } from './state/settings'

type Page = 'perfil' | 'peticiones' | 'solicitudes' | 'config'

type AppProps = {
  amplifyReady: boolean
  auth?: {
    username: string | null
    signOut: (() => void) | null
  }
}

const labels: Record<Page, string> = {
  perfil: 'Perfil',
  peticiones: 'Peticiones',
  solicitudes: 'Solicitudes',
  config: 'Configuracion',
}

export default function App({ amplifyReady, auth }: AppProps) {
  const [page, setPage] = useState<Page>('perfil')
  const [toast, setToast] = useState<ToastState>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

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

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <Toast toast={toast} onClear={() => setToast(null)} />
      <header className="border-b border-zinc-200/70 bg-white/70 px-4 py-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">AgroTrocha</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['perfil', 'peticiones', 'solicitudes', 'config'] as Page[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPage(item)}
                className={
                  'rounded-2xl px-4 py-2 text-sm font-semibold transition ' +
                  (page === item
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-zinc-200/70 bg-white/80 text-zinc-800 hover:border-emerald-500 hover:text-emerald-700 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-200')
                }
              >
                {labels[item]}
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

        {page === 'solicitudes' ? (
          <SolicitudesModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            username={auth?.username ?? null}
            onToast={(next) => setToast(next)}
          />
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
