import type { ReactNode } from 'react'

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={
        'rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm backdrop-blur ' +
        'dark:border-zinc-800/60 dark:bg-zinc-950/40 ' +
        (className ?? '')
      }
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{subtitle}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}
