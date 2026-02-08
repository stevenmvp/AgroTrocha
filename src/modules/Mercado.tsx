import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { getErrorMessage } from '../lib/getErrorMessage'
import { consumeNavIntent, setNavIntent } from '../state/navIntent'
import type { NavKey } from '../components/BottomNav'

export function MercadoModule({
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
  const [items, setItems] = useState<Schema['PriceReference']['type'][]>([])

  const [municipio, setMunicipio] = useState('')
  const [product, setProduct] = useState('')

  const canUseBackend = amplifyReady && isOnline
  const pad = density === 'compact' ? 'p-3' : 'p-4'

  useEffect(() => {
    const intent = consumeNavIntent()
    if (intent?.kind === 'dashboardFilters') {
      if (typeof intent.municipio === 'string') setMunicipio(intent.municipio)
      if (typeof intent.product === 'string') setProduct(intent.product)
    }
  }, [])

  async function refresh() {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const res = await client.models.PriceReference.list({ limit: 500 })
      setItems(res.data ?? [])
      onToast({ kind: 'success', message: `Cargados: ${res.data?.length ?? 0}.` })
    } catch (e) {
      onToast({ kind: 'error', message: `No pude cargar precios: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!canUseBackend) return
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseBackend])

  const filtered = useMemo(() => {
    const m = municipio.trim().toLowerCase()
    const p = product.trim().toLowerCase()
    return items
      .filter((r) => {
        const okM = !m || String(r.municipio ?? '').toLowerCase().includes(m)
        const okP = !p || String(r.product ?? '').toLowerCase().includes(p)
        return okM && okP
      })
      .slice()
      .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
  }, [items, municipio, product])

  const series = useMemo(() => {
    // average price by day
    const map = new Map<string, { day: string; sum: number; n: number }>()
    for (const r of filtered) {
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
      .slice(-90)
  }, [filtered])

  return (
    <main className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Backend" value={amplifyReady ? 'Listo' : 'Local'} tone={amplifyReady ? 'brand' : 'neutral'} />
          <StatCard label="Conexión" value={isOnline ? 'Online' : 'Offline'} tone={isOnline ? 'good' : 'warn'} />
          <StatCard label="Registros" value={filtered.length} />
          <StatCard label="Producto" value={product.trim() ? product : '—'} />
        </div>

        <Card className={pad}>
          <CardHeader
            title="Mercado (Precios)"
            subtitle="Muestra PriceReference. Para precios reales de Colombia hay que sincronizar una fuente externa."
            right={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  onClick={() => {
                    setNavIntent({ kind: 'dashboardFilters', municipio, product })
                    onNavigate('dashboard')
                  }}
                >
                  Ver en Panel
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
                  onClick={refresh}
                  disabled={busy}
                >
                  {busy ? 'Actualizando…' : 'Actualizar'}
                </button>
              </div>
            }
          />

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 font-medium">Municipio</div>
              <input
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                placeholder="Ej: Aquitania"
              />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">Producto</div>
              <input
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Ej: cebolla"
              />
            </label>
          </div>

          {!canUseBackend ? (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Offline/local: no se puede consultar.</div>
          ) : null}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Card className={pad}>
              <CardHeader title="Serie de precios" subtitle="Promedio diario (filtrado)." />
              <div className="mt-4 h-72">
                {series.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">Sin datos para graficar.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series}>
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

          <div className="lg:col-span-5">
            <Card className={pad}>
              <CardHeader title="Últimos registros" subtitle="Tabla rápida (máx 12)." />

              <div className="mt-4 space-y-2">
                {filtered
                  .slice()
                  .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
                  .slice(0, 12)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-zinc-200/70 bg-white/60 p-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{r.product}</div>
                          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                            {r.municipio ?? '—'} · {r.market ?? '—'} · {r.date}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold">{r.price}</div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-300">{r.unit ?? '—'}</div>
                        </div>
                      </div>
                    </div>
                  ))}

                {filtered.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">No hay datos en PriceReference.</div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
