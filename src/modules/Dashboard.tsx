import { useEffect, useMemo, useState } from 'react'
import { loadPetitions as loadLocalPetitions } from './Peticiones'
import { on, emit } from '../lib/events'

export function DashboardModule({ amplifyReady, isOnline }: { amplifyReady: boolean; isOnline: boolean }) {
  const [remoteCount, setRemoteCount] = useState<number | null>(null)
  const [local, setLocal] = useState(() => loadLocalPetitions())

  useEffect(() => {
    // Combine local + some fictional remote count for demo
    if (!amplifyReady || !isOnline) {
      setRemoteCount(null)
      return
    }
    // Simulate remote data with a delay
    const timer = setTimeout(() => {
      setRemoteCount(Math.floor(Math.random() * 50) + 20)
    }, 500)
    return () => clearTimeout(timer)
  }, [amplifyReady, isOnline])

  useEffect(() => {
    const off = on('petitions:changed', () => setLocal(loadLocalPetitions()))
    return () => off()
  }, [])

  // when no backend, try loading sample data from public/seed-data
  useEffect(() => {
    if (amplifyReady || isOnline) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/seed-data/Order.json')
        if (!res.ok) return
        const data = (await res.json()) as any[]
        if (!cancelled) setLocal(data.map((d) => ({ ...d, sent: Boolean(d.sent) })))
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [amplifyReady, isOnline])

  const stats = useMemo(() => {
    const totalLocal = local.length
    const synced = local.filter((p) => p.sent).length
    const pending = totalLocal - synced
    return { totalLocal, synced, pending, remoteCount }
  }, [local, remoteCount])

  function handleRefresh() {
    // ask Peticiones to refresh remote orders
    try {
      emit('petitions:refresh')
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border p-4 bg-white/70 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Panel</div>
          <div className="text-sm text-zinc-600">Resumen rápido de actividad</div>
        </div>
        <div>
          <button className="rounded-xl border px-3 py-2" onClick={handleRefresh}>Recargar</button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border p-4 bg-white/70">
          <div className="text-xs text-zinc-500">Peticiones locales</div>
          <div className="mt-2 text-2xl font-bold">{stats.totalLocal}</div>
          <div className="text-sm text-zinc-600">Pendientes: {stats.pending} · Sincronizadas: {stats.synced}</div>
        </div>
        <div className="rounded-2xl border p-4 bg-white/70">
          <div className="text-xs text-zinc-500">Peticiones remotas (conteo)</div>
          <div className="mt-2 text-2xl font-bold">{stats.remoteCount ?? '—'}</div>
          <div className="text-sm text-zinc-600">Conexión: {amplifyReady && isOnline ? 'OK' : 'Offline/No backend'}</div>
        </div>
        <div className="rounded-2xl border p-4 bg-white/70">
          <div className="text-xs text-zinc-500">Sincronización</div>
          <div className="mt-2 text-sm text-zinc-600">Este panel muestra actividad local y conteo remoto cuando hay backend.</div>
        </div>
      </section>

      <section className="rounded-2xl border p-4 bg-white/70">
        <div className="text-sm font-semibold">Gráfica sencilla</div>
        <div className="mt-3 h-28">
          <svg viewBox="0 0 300 100" className="w-full h-full">
            {/* Bars: pending, synced */}
            {(() => {
              const total = Math.max(1, stats.totalLocal)
              const pendingH = Math.round((stats.pending / total) * 80)
              const syncedH = Math.round((stats.synced / total) * 80)
              return (
                <g transform="translate(20,10)">
                  <rect x="0" y={80 - pendingH} width="60" height={pendingH} fill="#f59e0b" rx="4" />
                  <text x="30" y="95" fontSize="10" textAnchor="middle">Pendientes</text>
                  <rect x="100" y={80 - syncedH} width="60" height={syncedH} fill="#10b981" rx="4" />
                  <text x="130" y="95" fontSize="10" textAnchor="middle">Sincronizadas</text>
                </g>
              )
            })()}
          </svg>
        </div>
      </section>
    </div>
  )
}

export default DashboardModule
