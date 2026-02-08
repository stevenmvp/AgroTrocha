import type { ReactNode } from 'react'

export type NavKey =
  | 'dashboard'
  | 'reportes'
  | 'consolidaciones'
  | 'pendientes'
  | 'productos'
  | 'mercado'
  | 'solicitudes'
  | 'alertas'
  | 'notificaciones'
  | 'ia'
  | 'config'

type Tab = {
  key: NavKey
  label: string
}

const tabs: Tab[] = [
  { key: 'dashboard', label: 'Panel' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'consolidaciones', label: 'Consolid.' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'productos', label: 'Productos' },
  { key: 'mercado', label: 'Mercado' },
  { key: 'solicitudes', label: 'Solicitudes' },
  { key: 'alertas', label: 'Alertas' },
  { key: 'notificaciones', label: 'Notifs' },
  { key: 'ia', label: 'IA' },
  { key: 'config', label: 'Config' },
]

export function BottomNav({ active, onChange }: { active: NavKey; onChange: (key: NavKey) => void }) {
  return (
    <>
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:flex-col md:border-r md:border-zinc-200/70 md:bg-white/70 md:backdrop-blur dark:md:border-zinc-800/60 dark:md:bg-zinc-950/40">
        <div className="px-4 py-4">
          <div className="text-sm font-semibold">AgroTrocha</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-300">MVP</div>
        </div>
        <div className="flex flex-1 flex-col gap-2 px-3 pb-4">
          {tabs.map((t) => {
            const isActive = t.key === active
            return (
              <button
                key={t.key}
                type="button"
                className={
                  'rounded-xl px-3 py-3 text-left text-sm font-semibold ' +
                  (isActive
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950'
                    : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-50')
                }
                onClick={() => onChange(t.key)}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </aside>

      <nav className="sticky bottom-0 z-10 border-t border-zinc-200/70 bg-white/90 backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-950/80 md:hidden">
        <div className="mx-auto flex max-w-xl gap-2 overflow-x-auto px-2 py-2">
          {tabs.map((t) => {
            const isActive = t.key === active
            return (
              <button
                key={t.key}
                type="button"
                className={
                  'shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ' +
                  (isActive
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950'
                    : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-50')
                }
                onClick={() => onChange(t.key)}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export function Page({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur dark:bg-slate-950/70 dark:border-slate-800">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3 md:max-w-6xl">
        <div>
          <div className="text-lg font-semibold leading-none">{title}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">AgroTrocha (MVP)</div>
        </div>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>
    </header>
  )
}
