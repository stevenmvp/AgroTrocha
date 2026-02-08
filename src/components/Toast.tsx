import { useEffect } from 'react'

export type ToastState = {
  message: string
  kind: 'success' | 'error' | 'info'
} | null

export function Toast({ toast, onClear }: { toast: ToastState; onClear: () => void }) {
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => onClear(), 3000)
    return () => window.clearTimeout(id)
  }, [toast, onClear])

  if (!toast) return null

  const cls =
    toast.kind === 'success'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : toast.kind === 'error'
        ? 'bg-rose-50 text-rose-900 border-rose-200'
        : 'bg-slate-50 text-slate-900 border-slate-200'

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-50">
      <div className="mx-auto max-w-xl px-2">
        <div className={`pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-sm ${cls}`}>{toast.message}</div>
      </div>
    </div>
  )
}
