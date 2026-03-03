import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { type NavKey } from './components/BottomNav'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { Toast, type ToastState } from './components/Toast'
import { AlertasModule } from './modules/Alertas'
import { ConsolidacionesModule } from './modules/Consolidaciones'
import { ConfigModule } from './modules/Config'
import { DashboardModule } from './modules/Dashboard'
import { IAModule } from './modules/IA'
import { MercadoModule } from './modules/Mercado'
import { NotificacionesModule } from './modules/Notificaciones'
import { PendientesModule } from './modules/Pendientes'
import { ProductosModule } from './modules/Productos'
import { ReportesModule } from './modules/Reportes'
import { SolicitudesModule } from './modules/Solicitudes'
import { getErrorMessage } from './lib/getErrorMessage'
import { loadSettings, saveSettings, type Density, type Theme } from './state/settings'

type BackendHealth = {
  status: 'checking' | 'ok' | 'offline' | 'error'
  detail: string
}

type AppProps = {
  amplifyReady: boolean
  auth?: {
    username: string | null
    signOut: (() => void) | null
  }
}

function App({ amplifyReady, auth }: AppProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [backendHealth, setBackendHealth] = useState<BackendHealth>({
    status: 'checking',
    detail: 'Validando conexión al backend…',
  })
  const [active, setActive] = useState<NavKey>('dashboard')
  const [toast, setToast] = useState<ToastState>(null)
  const [density, setDensity] = useState<Density>(() => loadSettings().density)
  const [sttEnabled, setSttEnabled] = useState(() => loadSettings().sttEnabled)
  const [ttsEnabled, setTtsEnabled] = useState(() => loadSettings().ttsEnabled)
  const [theme, setTheme] = useState<Theme>(() => loadSettings().theme)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    async function runHealthCheck() {
      if (!isOnline) {
        if (!cancelled) {
          setBackendHealth({
            status: 'offline',
            detail: 'Sin internet. Trabajando en modo offline y reintento pendiente.',
          })
        }
        return
      }

      if (!amplifyReady) {
        if (!cancelled) {
          setBackendHealth({
            status: 'error',
            detail: 'Amplify no está configurado correctamente.',
          })
        }
        return
      }

      if (!cancelled) {
        setBackendHealth({
          status: 'checking',
          detail: 'Verificando conexión con base de datos…',
        })
      }

      try {
        const client = generateClient<Schema>()
        const result = await client.models.Country.list({ limit: 1 })
        const resultErrors = (result as { errors?: unknown[] }).errors
        if (Array.isArray(resultErrors) && resultErrors.length > 0) {
          throw resultErrors[0]
        }

        if (!cancelled) {
          setBackendHealth({
            status: 'ok',
            detail: 'Amplify y base de datos conectados.',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setBackendHealth({
            status: 'error',
            detail: `Error backend: ${getErrorMessage(error)}`,
          })
        }
      }
    }

    void runHealthCheck()
    timer = window.setInterval(() => {
      void runHealthCheck()
    }, 60000)

    return () => {
      cancelled = true
      if (timer !== null) window.clearInterval(timer)
    }
  }, [amplifyReady, isOnline])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

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

  const title = useMemo(() => {
    switch (active) {
      case 'dashboard':
        return 'Panel'
      case 'reportes':
        return 'Reportes'
      case 'consolidaciones':
        return 'Consolidaciones'
      case 'pendientes':
        return 'Pendientes'
      case 'productos':
        return 'Productos'
      case 'mercado':
        return 'Mercado'
      case 'solicitudes':
        return 'Solicitudes'
      case 'alertas':
        return 'Alertas'
      case 'notificaciones':
        return 'Notificaciones'
      case 'ia':
        return 'IA'
      case 'config':
        return 'Configuración'
      default:
        return 'AgroTrocha'
    }
  }, [active])

  function onChangeDensity(next: Density) {
    setDensity(next)
    saveSettings({ density: next, sttEnabled, ttsEnabled, theme })
    setToast({ kind: 'success', message: 'Configuración guardada.' })
  }

  function onChangeStt(next: boolean) {
    setSttEnabled(next)
    saveSettings({ density, sttEnabled: next, ttsEnabled, theme })
    setToast({ kind: 'success', message: 'Configuración guardada.' })
  }

  function onChangeTts(next: boolean) {
    setTtsEnabled(next)
    saveSettings({ density, sttEnabled, ttsEnabled: next, theme })
    setToast({ kind: 'success', message: 'Configuración guardada.' })
  }

  function onChangeTheme(next: Theme) {
    setTheme(next)
    saveSettings({ density, sttEnabled, ttsEnabled, theme: next })
    setToast({ kind: 'success', message: 'Configuración guardada.' })
  }

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 md:flex">
      <Toast toast={toast} onClear={() => setToast(null)} />

      <Sidebar
        active={active}
        onChange={setActive}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        backendHealth={backendHealth}
      />

      <div className="min-w-0 md:flex-1">
        <TopBar
          title={title}
          isOnline={isOnline}
          amplifyReady={amplifyReady}
          username={auth?.username ?? null}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          onGoNotifications={() => setActive('notificaciones')}
        />

        {active === 'dashboard' ? (
          <DashboardModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            density={density}
            onToast={(t) => setToast(t)}
          />
        ) : null}

        {active === 'reportes' ? (
          <ReportesModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            density={density}
            onToast={(t) => setToast(t)}
            onNavigate={(k) => setActive(k)}
          />
        ) : null}

        {active === 'consolidaciones' ? (
          <ConsolidacionesModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            density={density}
            onToast={(t) => setToast(t)}
            onNavigate={(k) => setActive(k)}
          />
        ) : null}

        {active === 'pendientes' ? (
          <PendientesModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            density={density}
            sttEnabled={sttEnabled}
            username={auth?.username ?? null}
            onToast={(t) => setToast(t)}
            onNavigate={(k) => setActive(k)}
          />
        ) : null}

        {active === 'productos' ? (
          <ProductosModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            density={density}
            onToast={(t) => setToast(t)}
            onNavigate={(k) => setActive(k)}
          />
        ) : null}

        {active === 'mercado' ? (
          <MercadoModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            density={density}
            onToast={(t) => setToast(t)}
            onNavigate={(k) => setActive(k)}
          />
        ) : null}

        {active === 'solicitudes' ? (
          <SolicitudesModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            density={density}
            onToast={(t) => setToast(t)}
            onNavigate={(k) => setActive(k)}
          />
        ) : null}

        {active === 'alertas' ? (
          <AlertasModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            density={density}
            onToast={(t) => setToast(t)}
          />
        ) : null}

        {active === 'notificaciones' ? (
          <NotificacionesModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            density={density}
            onToast={(t) => setToast(t)}
          />
        ) : null}

        {active === 'ia' ? (
          <IAModule
            amplifyReady={amplifyReady}
            isOnline={isOnline}
            sttEnabled={sttEnabled}
            ttsEnabled={ttsEnabled}
            onToast={(t) => setToast(t)}
          />
        ) : null}

        {active === 'config' ? (
          <ConfigModule
            density={density}
            onChangeDensity={onChangeDensity}
            sttEnabled={sttEnabled}
            ttsEnabled={ttsEnabled}
            onChangeStt={onChangeStt}
            onChangeTts={onChangeTts}
            theme={theme}
            onChangeTheme={onChangeTheme}
            username={auth?.username ?? null}
            amplifyReady={amplifyReady}
            signOut={auth?.signOut ?? null}
            onToast={(t) => setToast(t)}
          />
        ) : null}
      </div>
    </div>
  )
}

export default App
