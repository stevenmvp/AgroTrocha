import type { Density, Theme } from '../state/settings'
import { PerfilContent } from './Perfil'

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
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-4 md:max-w-3xl">
      <section className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <h2 className="text-base font-semibold">Sesión</h2>
        <p className="mt-1 text-sm text-slate-600">Cuenta y acceso.</p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-600">Usuario</div>
            <div className="text-sm">{username ?? '—'}</div>
          </div>
          {signOut ? (
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
              onClick={signOut}
            >
              Salir
            </button>
          ) : null}
        </div>

        <div className="mt-2 text-xs text-slate-600">
          {amplifyReady ? 'Backend listo.' : 'Modo local: sin Auth/backend.'}
        </div>
      </section>

      <PerfilContent username={username} amplifyReady={amplifyReady} onToast={onToast} />

      <section className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <h2 className="text-base font-semibold">Apariencia</h2>
        <p className="mt-1 text-sm text-slate-600">Minimalista vs cargado: controlamos densidad (espaciado) sin cambiar colores.</p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Tema</div>
            <div className="text-xs text-slate-600">Claro u oscuro.</div>
          </div>
          <select
            className="rounded-xl border bg-white px-3 py-2 text-sm"
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
            <div className="text-xs text-slate-600">Compacto muestra más info por pantalla.</div>
          </div>
          <select
            className="rounded-xl border bg-white px-3 py-2 text-sm"
            value={density}
            onChange={(e) => onChangeDensity(e.target.value as Density)}
          >
            <option value="comfortable">Cómodo</option>
            <option value="compact">Compacto</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <h2 className="text-base font-semibold">Voz (IA)</h2>
        <p className="mt-1 text-sm text-slate-600">Flexibilidad: dictado (STT) y lectura en voz alta (TTS) si el navegador lo soporta.</p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Dictado</div>
            <div className="text-xs text-slate-600">Usa reconocimiento de voz del navegador.</div>
          </div>
          <button
            type="button"
            className={
              'rounded-xl border px-3 py-2 text-sm font-semibold ' +
              (sttEnabled ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900')
            }
            onClick={() => onChangeStt(!sttEnabled)}
          >
            {sttEnabled ? 'Activado' : 'Desactivado'}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Lectura</div>
            <div className="text-xs text-slate-600">Lee respuestas de la IA en voz alta.</div>
          </div>
          <button
            type="button"
            className={
              'rounded-xl border px-3 py-2 text-sm font-semibold ' +
              (ttsEnabled ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900')
            }
            onClick={() => onChangeTts(!ttsEnabled)}
          >
            {ttsEnabled ? 'Activado' : 'Desactivado'}
          </button>
        </div>
      </section>
    </main>
  )
}
