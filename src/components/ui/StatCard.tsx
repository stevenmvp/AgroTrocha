import type { ReactNode } from 'react'
import { Card } from './Card'

export function StatCard({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'brand'
}) {
  const toneClasses =
    tone === 'good'
      ? 'border-l-4 border-l-emerald-500'
      : tone === 'warn'
        ? 'border-l-4 border-l-amber-500'
        : tone === 'brand'
          ? 'border-l-4 border-l-emerald-600'
          : 'border-l-4 border-l-zinc-300 dark:border-l-zinc-700'

  return (
    <Card className={'p-3 ' + toneClasses}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</div>
          <div className="mt-1 text-sm font-semibold">{value}</div>
        </div>
        {icon ? <div className="text-zinc-500 dark:text-zinc-300">{icon}</div> : null}
      </div>
    </Card>
  )
}
