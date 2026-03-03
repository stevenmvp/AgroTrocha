import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { getErrorMessage } from '../lib/getErrorMessage'
import { consumeNavIntent } from '../state/navIntent'

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

function normalizeDay(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return ''
  // pickupDate is YYYY-MM-DD; createdAt is ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const PIE_COLORS = [
  'rgb(var(--agt-chart-1))',
  'rgb(var(--agt-chart-2))',
  'rgb(var(--agt-chart-3))',
  'rgb(var(--agt-chart-4))',
  'rgb(var(--agt-chart-5))',
  'rgb(var(--agt-chart-6))',
]

export function DashboardModule({
  amplifyReady,
  isOnline,
  density,
  onToast,
}: {
  amplifyReady: boolean
  isOnline: boolean
  density: 'compact' | 'comfortable'
  onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void
}) {
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState<PublicOrderView[]>([])
  const [prices, setPrices] = useState<Schema['PriceReference']['type'][]>([])

  const [municipioFilter, setMunicipioFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')

  const canUseBackend = amplifyReady && isOnline

  async function refresh() {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()

      const [ordersRes, pricesRes] = await Promise.all([
        client.queries.listPublicOrdersForMyMunicipio({}),
        client.models.PriceReference.list({ limit: 300 }),
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
      setPrices(pricesRes.data ?? [])
      onToast({ kind: 'success', message: 'Panel actualizado.' })
    } catch (e) {
      onToast({ kind: 'error', message: `No pude cargar el panel: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const intent = consumeNavIntent()
    if (intent?.kind === 'dashboardFilters') {
      if (typeof intent.municipio === 'string') setMunicipioFilter(intent.municipio)
      if (typeof intent.product === 'string') setProductFilter(intent.product)
    }
  }, [])

  useEffect(() => {
    if (!canUseBackend) return
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseBackend])

  const filteredOrders = useMemo(() => {
    const m = municipioFilter.trim().toLowerCase()
    const p = productFilter.trim().toLowerCase()
    return orders.filter((o) => {
      const okM = !m || String(o.municipio ?? '').toLowerCase().includes(m)
      const okP = !p || String(o.product ?? '').toLowerCase().includes(p)
      return okM && okP
    })
  }, [orders, municipioFilter, productFilter])

  const filteredPrices = useMemo(() => {
    const m = municipioFilter.trim().toLowerCase()
    const p = productFilter.trim().toLowerCase()
    return prices
      .filter((r) => {
        const okM = !m || String(r.municipio ?? '').toLowerCase().includes(m)
        const okP = !p || String(r.product ?? '').toLowerCase().includes(p)
        return okM && okP
      })
      .slice()
      .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
  }, [prices, municipioFilter, productFilter])

  const statusData = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of filteredOrders) {
      const status = String(o.status ?? 'PENDIENTE')
      map.set(status, (map.get(status) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filteredOrders])

  const ordersByDay = useMemo(() => {
    const map = new Map<string, { day: string; total: number }>()
    for (const o of filteredOrders) {
      const day = normalizeDay(o.pickupDate ?? o.createdAt ?? null)
      if (!day) continue
      const prev = map.get(day) ?? { day, total: 0 }
      prev.total += 1
      map.set(day, prev)
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day)).slice(-30)
  }, [filteredOrders])

  const priceSeries = useMemo(() => {
    // Avg price per day
    const map = new Map<string, { day: string; sum: number; n: number }>()
    for (const r of filteredPrices) {
      const day = String(r.date ?? '')
      if (!day) continue
      const prev = map.get(day) ?? { day, sum: 0, n: 0 }
      prev.sum += Number(r.price ?? 0)
      prev.n += 1
      map.set(day, prev)
    }
    return Array.from(map.values())
      .map((x) => ({ day: x.day, price: x.n > 0 ? Math.round((x.sum / x.n) * 100) / 100 : 0 }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-60)
  }, [filteredPrices])

  const totalOrders = filteredOrders.length
  const totalPrices = filteredPrices.length

  const pad = density === 'compact' ? 'p-3' : 'p-4'

  return (
    <main className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Conectividad" value={isOnline ? 'Online' : 'Offline'} tone={isOnline ? 'good' : 'warn'} />
          <StatCard label="Backend" value={amplifyReady ? 'Listo' : 'Local'} tone={amplifyReady ? 'brand' : 'neutral'} />
          <StatCard label="Pendientes (filtro)" value={totalOrders} tone="neutral" />
          <StatCard label="Precios (filtro)" value={totalPrices} tone="neutral" />
        </div>

        <Card className={pad}>
          <CardHeader
            title="Filtros"
            subtitle="Filtra por municipio y producto (aplica a pendientes y precios)."
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
            <label className="text-sm">
              <div className="mb-1 font-medium">Municipio</div>
              <input
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={municipioFilter}
                onChange={(e) => setMunicipioFilter(e.target.value)}
                placeholder="Ej: Aquitania"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Producto</div>
              <input
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="Ej: cebolla"
              />
            </label>
          </div>

          {!canUseBackend ? (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Sin conexión o backend no disponible: no se puede cargar analítica.
            </div>
          ) : null}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Card className={pad}>
              <CardHeader
                title="Estados de pendientes"
                subtitle={totalOrders ? 'Distribución por estado (según tu municipio / filtro).' : 'Sin datos todavía.'}
              />

              <div className="mt-4 h-64">
                {statusData.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">No hay pendientes para graficar.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90}>
                        {statusData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-7">
            <Card className={pad}>
              <CardHeader
                title="Pendientes por día"
                subtitle="Conteo por fecha (pickupDate si existe, si no createdAt)."
              />

              <div className="mt-4 h-64">
                {ordersByDay.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">No hay datos suficientes.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ordersByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" hide />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" name="Pendientes" fill={'rgb(var(--agt-chart-1))'} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-12">
            <Card className={pad}>
              <CardHeader
                title="Precios (referencias)"
                subtitle={
                  priceSeries.length
                    ? 'Promedio diario (requiere datos en PriceReference).'
                    : 'No hay datos en PriceReference todavía.'
                }
              />

              <div className="mt-4 h-72">
                {priceSeries.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">
                    Para ver precios reales de Colombia aquí, necesitas una fuente de datos.
                    Si me das una API (URL + formato + credenciales), lo conecto a ExternalApi/sync.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" hide />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="price"
                        name="Precio (prom)"
                        stroke={'rgb(var(--agt-chart-1))'}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
