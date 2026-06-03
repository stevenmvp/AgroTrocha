import type { Density, Theme } from '../state/settings'

type ConfigModuleProps = {
  username: string | null
  amplifyReady: boolean
  isOnline: boolean
  density: Density
  theme: Theme
  sttEnabled: boolean
  ttsEnabled: boolean
  onChangeDensity: (next: Density) => void
  onChangeTheme: (next: Theme) => void
  onChangeStt: (next: boolean) => void
  onChangeTts: (next: boolean) => void
  signOut: (() => void) | null
  onToast: (toast: { kind: 'success' | 'error' | 'info'; message: string }) => void
}

export function ConfigModule({
  username,
  amplifyReady,
  isOnline,
  density,
  theme,
  sttEnabled,
  ttsEnabled,
  onChangeDensity,
  onChangeTheme,
  onChangeStt,
  onChangeTts,
  signOut,
  onToast,
}: ConfigModuleProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
        <div className="text-xl font-semibold">Configuración</div>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Gestiona tu sesión y las preferencias de la interfaz.
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40">
            <div className="text-sm font-semibold">Usuario</div>
            <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{username ?? 'Sin usuario'}</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {amplifyReady ? (isOnline ? 'Backend online' : 'Backend listo, sin conexión') : 'Backend no configurado'}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40">
            <div className="text-sm font-semibold">Acción</div>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950"
              onClick={() => {
                if (!signOut) {
                  onToast({ kind: 'info', message: 'No hay función de cierre de sesión disponible.' })
                  return
                }
                signOut()
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40">
            <div className="text-sm font-semibold">Tema</div>
            <select
              value={theme}
              onChange={(e) => onChangeTheme(e.target.value as Theme)}
              className="mt-3 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            >
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </select>
          </div>

          <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40">
            <div className="text-sm font-semibold">Densidad</div>
            <select
              value={density}
              onChange={(e) => onChangeDensity(e.target.value as Density)}
              className="mt-3 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            >
              <option value="comfortable">Cómodo</option>
              <option value="compact">Compacto</option>
            </select>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200/70 bg-zinc-50/80 p-4 text-sm text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-200">
          <div className="font-semibold">Voz y accesibilidad</div>
          <div className="mt-3 grid gap-3">
            <button
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                sttEnabled
                  ? 'border border-emerald-600 bg-emerald-600 text-white'
                  : 'border border-zinc-200/70 bg-white/70 text-zinc-800 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-200'
              }`}
              onClick={() => onChangeStt(!sttEnabled)}
            >
              Dictado: {sttEnabled ? 'Activado' : 'Desactivado'}
            </button>
            <button
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                ttsEnabled
                  ? 'border border-emerald-600 bg-emerald-600 text-white'
                  : 'border border-zinc-200/70 bg-white/70 text-zinc-800 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-200'
              }`}
              onClick={() => onChangeTts(!ttsEnabled)}
            >
              Lectura: {ttsEnabled ? 'Activada' : 'Desactivada'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
