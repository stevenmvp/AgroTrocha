import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { getErrorMessage } from '../lib/getErrorMessage'
import { setNavIntent } from '../state/navIntent'
import type { NavKey } from '../components/BottomNav'

type PublicOrderView = {
  orderId?: string | null
  orderNumber?: number | null
  status?: string | null
  municipio?: string | null
  product?: string | null
  quantity?: number | null
  unit?: string | null
  pickupDate?: string | null
  createdAt?: string | null
}

export function ReportesModule({
  amplifyReady,
  isOnline,
  density,
  onToast,
  onNavigate,
}: {
  amplifyReady: boolean
  isOnline: boolean
  density: 'compact' | 'comfortable'
  onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void
  onNavigate: (key: NavKey) => void
}) {
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState<PublicOrderView[]>([])
  const [requests, setRequests] = useState<Schema['Request']['type'][]>([])
  const canUseBackend = amplifyReady && isOnline
  const pad = density === 'compact' ? 'p-3' : 'p-4'

  async function refresh() {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const [ordersRes, reqRes] = await Promise.all([
        client.queries.listPublicOrdersForMyMunicipio({}),
        client.models.Request.list({ limit: 200 }),
      ])

      const parsedOrders = (() => {
        if (typeof ordersRes.data !== 'string') return [] as PublicOrderView[]
        try {
          const parsed = JSON.parse(ordersRes.data) as unknown
          return Array.isArray(parsed) ? (parsed as PublicOrderView[]) : ([] as PublicOrderView[])
        } catch {
          return [] as PublicOrderView[]
        }
      })()

      setOrders(parsedOrders)
      setRequests(reqRes.data ?? [])
      onToast({ kind: 'success', message: 'Reportes actualizados.' })
    } catch (e) {
      onToast({ kind: 'error', message: `No pude cargar reportes: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!canUseBackend) return
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseBackend])

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) {
      const status = String(o.status ?? 'PENDIENTE')
      map.set(status, (map.get(status) ?? 0) + 1)
    }
    return map
  }, [orders])

  const openRequests = useMemo(() => requests.filter((r) => (r.status ?? 'OPEN') !== 'DONE').length, [requests])

  return (
    <main className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Pendientes (municipio)" value={orders.length} />
          <StatCard label="Solicitudes abiertas" value={openRequests} tone={openRequests > 0 ? 'warn' : 'neutral'} />
          <StatCard label="Entregados" value={statusCounts.get('ENTREGADO') ?? 0} tone="good" />
          <StatCard label="En tránsito" value={statusCounts.get('TRANSITO') ?? 0} />
        </div>

        <Card className={pad}>
          <CardHeader
            title="Reportes rápidos"
            subtitle="Resumen operativo para tomar decisiones y saltar a módulos relacionados."
            right={
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
                onClick={refresh}
                disabled={busy}
              >
                {busy ? 'Actualizando…' : 'Actualizar'}
              </button>
            }
          />

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              type="button"
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-4 py-4 text-left text-sm font-semibold shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40"
              onClick={() => onNavigate('pendientes')}
            >
              Ver Pendientes
              <div className="mt-1 text-xs font-normal text-zinc-600 dark:text-zinc-300">Publicaciones y estados.</div>
            </button>

            <button
              type="button"
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-4 py-4 text-left text-sm font-semibold shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40"
              onClick={() => onNavigate('solicitudes')}
            >
              Ver Solicitudes
              <div className="mt-1 text-xs font-normal text-zinc-600 dark:text-zinc-300">Soporte y cambios (offline-first).</div>
            </button>

            <button
              type="button"
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-4 py-4 text-left text-sm font-semibold shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40"
              onClick={() => {
                setNavIntent({ kind: 'dashboardFilters' })
                onNavigate('dashboard')
              }}
            >
              Abrir Panel
              <div className="mt-1 text-xs font-normal text-zinc-600 dark:text-zinc-300">Gráficas + filtros.</div>
            </button>

            <button
              type="button"
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-4 py-4 text-left text-sm font-semibold shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40"
              onClick={() => onNavigate('mercado')}
            >
              Abrir Mercado
              <div className="mt-1 text-xs font-normal text-zinc-600 dark:text-zinc-300">Series de precios (PriceReference).</div>
            </button>
          </div>

          {!canUseBackend ? (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Sin conexión o backend no disponible: no se puede cargar el resumen.
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  )
}
