import type { NavKey } from './BottomNav'

type Tab = {
  key: NavKey
  label: string
}

const tabs: Tab[] = [
  { key: 'dashboard', label: 'Panel' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'consolidaciones', label: 'Consolidaciones' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'productos', label: 'Productos' },
  { key: 'mercado', label: 'Mercado' },
  { key: 'solicitudes', label: 'Solicitudes' },
  { key: 'alertas', label: 'Alertas' },
  { key: 'notificaciones', label: 'Notificaciones' },
  { key: 'ia', label: 'IA' },
  { key: 'config', label: 'Config' },
]

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export function Sidebar({
  active,
  onChange,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  active: NavKey
  onChange: (key: NavKey) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const content = (
    <aside
      className={
        'h-dvh border-r border-zinc-200/70 bg-white/70 backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-950/40 ' +
        'transition-[width] duration-200 ease-out ' +
        (collapsed ? 'w-20' : 'w-64')
      }
    >
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{collapsed ? 'AT' : 'AgroTrocha'}</div>
          <div className="truncate text-xs text-slate-600 dark:text-slate-300">{collapsed ? '' : 'MVP'}</div>
        </div>
        <button
          type="button"
          className="hidden rounded-xl border border-zinc-200/70 bg-white/70 p-2 dark:border-zinc-800/60 dark:bg-zinc-950/40 md:inline-flex"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
        >
          <ChevronIcon className={'h-5 w-5 transition-transform ' + (collapsed ? '' : 'rotate-180')} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-2 pb-4">
        {tabs.map((t) => {
          const isActive = t.key === active
          const short = t.label.slice(0, 1)
          return (
            <button
              key={t.key}
              type="button"
              className={
                'flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ' +
                (isActive
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-50')
              }
              onClick={() => {
                onChange(t.key)
                onCloseMobile()
              }}
              title={collapsed ? t.label : undefined}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/70 text-xs font-bold text-zinc-950 dark:bg-zinc-950/60 dark:text-zinc-50">
                {short}
              </span>
              {!collapsed ? <span className="truncate">{t.label}</span> : null}
            </button>
          )
        })}
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden md:sticky md:top-0 md:block">{content}</div>

      {/* Mobile overlay */}
      <div className={mobileOpen ? 'fixed inset-0 z-30 md:hidden' : 'hidden'}>
        <button type="button" className="absolute inset-0 bg-black/40" onClick={onCloseMobile} aria-label="Cerrar menú" />
        <div className={'absolute left-0 top-0 h-dvh transition-transform duration-200 ease-out ' + (mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
          {content}
        </div>
      </div>
    </>
  )
}
