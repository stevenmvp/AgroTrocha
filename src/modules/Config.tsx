import type { Density, Theme } from '../state/settings'
import { PerfilContent } from './Perfil'
import { Card, CardHeader } from '../components/ui/Card'

export function ConfigModule({
  density,
  onChangeDensity,
  sttEnabled,
  ttsEnabled,
  onChangeStt,
  onChangeTts,
  theme,
  onChangeTheme,
  username,
  amplifyReady,
  signOut,
  onToast,
}: {
  density: Density
  onChangeDensity: (d: Density) => void
  sttEnabled: boolean
  ttsEnabled: boolean
  onChangeStt: (v: boolean) => void
  onChangeTts: (v: boolean) => void
  theme: Theme
  onChangeTheme: (t: Theme) => void
  username: string | null
  amplifyReady: boolean
  signOut: (() => void) | null
  onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void
}) {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4">
      <Card className={density === 'compact' ? 'p-3' : 'p-4'}>
        <CardHeader title="Sesión" subtitle="Cuenta y acceso." />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Usuario</div>
            <div className="text-sm">{username ?? '—'}</div>
          </div>
          {signOut ? (
            <button
              type="button"
              className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
              onClick={signOut}
            >
              Salir
            </button>
          ) : null}
        </div>

        <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
          {amplifyReady ? 'Backend listo.' : 'Modo local: sin Auth/backend.'}
        </div>
      </Card>

      <PerfilContent username={username} amplifyReady={amplifyReady} onToast={onToast} />

      <Card className={density === 'compact' ? 'p-3' : 'p-4'}>
        <CardHeader
          title="Apariencia"
          subtitle="Minimalista vs cargado: controlamos densidad (espaciado) sin cambiar colores."
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Tema</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-300">Claro u oscuro.</div>
          </div>
          <select
            className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            value={theme}
            onChange={(e) => onChangeTheme(e.target.value as Theme)}
          >
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Densidad</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-300">Compacto muestra más info por pantalla.</div>
          </div>
          <select
            className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            value={density}
            onChange={(e) => onChangeDensity(e.target.value as Density)}
          >
            <option value="comfortable">Cómodo</option>
            <option value="compact">Compacto</option>
          </select>
        </div>
      </Card>

      <Card className={density === 'compact' ? 'p-3' : 'p-4'}>
        <CardHeader
          title="Voz (IA)"
          subtitle="Flexibilidad: dictado (STT) y lectura en voz alta (TTS) si el navegador lo soporta."
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Dictado</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-300">Usa reconocimiento de voz del navegador.</div>
          </div>
          <button
            type="button"
            className={
              'rounded-xl border px-3 py-2 text-sm font-semibold ' +
              (sttEnabled
                ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950'
                : 'border-zinc-200/70 bg-white/70 text-zinc-900 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-50')
            }
            onClick={() => onChangeStt(!sttEnabled)}
          >
            {sttEnabled ? 'Activado' : 'Desactivado'}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Lectura</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-300">Lee respuestas de la IA en voz alta.</div>
          </div>
          <button
            type="button"
            className={
              'rounded-xl border px-3 py-2 text-sm font-semibold ' +
              (ttsEnabled
                ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950'
                : 'border-zinc-200/70 bg-white/70 text-zinc-900 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-50')
            }
            onClick={() => onChangeTts(!ttsEnabled)}
          >
            {ttsEnabled ? 'Activado' : 'Desactivado'}
          </button>
        </div>
      </Card>
    </main>
  )
}
