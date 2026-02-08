import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NavKey } from '../components/BottomNav'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { getErrorMessage } from '../lib/getErrorMessage'
import { consumeNavIntent, setNavIntent } from '../state/navIntent'

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
  createdByName?: string | null
}

function normalizeDay(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ConsolidacionesModule({
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

  const [municipioFilter, setMunicipioFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [pickupDateFilter, setPickupDateFilter] = useState('')

  const canUseBackend = amplifyReady && isOnline
  const pad = density === 'compact' ? 'p-3' : 'p-4'

  useEffect(() => {
    const intent = consumeNavIntent()
    if (intent?.kind !== 'consolidationFocus') return
    if (typeof intent.municipio === 'string') setMunicipioFilter(intent.municipio)
    if (typeof intent.product === 'string') setProductFilter(intent.product)
    if (typeof intent.pickupDate === 'string') setPickupDateFilter(intent.pickupDate)
  }, [])

  async function refresh() {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const res = await client.queries.listPublicOrdersForMyMunicipio({})

      const parsedOrders = (() => {
        if (typeof res.data !== 'string') return [] as PublicOrderView[]
        try {
          const parsed = JSON.parse(res.data) as unknown
          return Array.isArray(parsed) ? (parsed as PublicOrderView[]) : ([] as PublicOrderView[])
        } catch {
          return [] as PublicOrderView[]
        }
      })()

      setOrders(parsedOrders)
      onToast({ kind: 'success', message: 'Consolidaciones actualizadas.' })
    } catch (e) {
      onToast({ kind: 'error', message: `No pude cargar consolidaciones: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!canUseBackend) return
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseBackend])

  const filteredOrders = useMemo(() => {
    const m = municipioFilter.trim().toLowerCase()
    const p = productFilter.trim().toLowerCase()
    const d = pickupDateFilter.trim()

    return orders.filter((o) => {
      const okM = !m || String(o.municipio ?? '').toLowerCase().includes(m)
      const okP = !p || String(o.product ?? '').toLowerCase().includes(p)
      const day = normalizeDay(o.pickupDate ?? o.createdAt ?? null)
      const okD = !d || day === d
      return okM && okP && okD
    })
  }, [orders, municipioFilter, productFilter, pickupDateFilter])

  const groups = useMemo(() => {
    type Group = {
      key: string
      day: string
      municipio: string
      product: string
      count: number
      sampleUnit: string
      totalQty: number
      producers: number
    }

    const map = new Map<string, Group>()
    for (const o of filteredOrders) {
      const day = normalizeDay(o.pickupDate ?? o.createdAt ?? null)
      const municipio = String(o.municipio ?? '')
      const product = String(o.product ?? '')
      const unit = String(o.unit ?? '')
      const qty = Number(o.quantity ?? 0)
      if (!day || !municipio || !product) continue

      const key = `${day}|${municipio}|${product}`
      const prev =
        map.get(key) ??
        ({
          key,
          day,
          municipio,
          product,
          count: 0,
          sampleUnit: unit,
          totalQty: 0,
          producers: 0,
        } satisfies Group)

      prev.count += 1
      prev.totalQty += qty
      if (!prev.sampleUnit && unit) prev.sampleUnit = unit
      map.set(key, prev)
    }

    // Approx producers by distinct createdByName within group (best-effort)
    const producerMap = new Map<string, Set<string>>()
    for (const o of filteredOrders) {
      const day = normalizeDay(o.pickupDate ?? o.createdAt ?? null)
      const municipio = String(o.municipio ?? '')
      const product = String(o.product ?? '')
      if (!day || !municipio || !product) continue
      const key = `${day}|${municipio}|${product}`
      const name = String(o.createdByName ?? '').trim()
      const set = producerMap.get(key) ?? new Set<string>()
      if (name) set.add(name)
      producerMap.set(key, set)
    }

    const list = Array.from(map.values()).map((g) => ({ ...g, producers: producerMap.get(g.key)?.size ?? 0 }))
    list.sort((a, b) => (b.count - a.count) || b.totalQty - a.totalQty)
    return list.slice(0, 24)
  }, [filteredOrders])

  const byDayChart = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of filteredOrders) {
      const day = normalizeDay(o.pickupDate ?? o.createdAt ?? null)
      if (!day) continue
      map.set(day, (map.get(day) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-21)
  }, [filteredOrders])

  return (
    <main className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Backend" value={amplifyReady ? 'Listo' : 'Local'} tone={amplifyReady ? 'brand' : 'neutral'} />
          <StatCard label="Conexión" value={isOnline ? 'Online' : 'Offline'} tone={isOnline ? 'good' : 'warn'} />
          <StatCard label="Pendientes (filtro)" value={filteredOrders.length} />
          <StatCard label="Grupos" value={groups.length} tone={groups.length > 0 ? 'good' : 'neutral'} />
        </div>

        <Card className={pad}>
          <CardHeader
            title="Consolidaciones (MVP)"
            subtitle="Agrupa por fecha + municipio + producto para sugerir consolidación."
            right={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  onClick={() => {
                    setNavIntent({ kind: 'dashboardFilters', municipio: municipioFilter, product: productFilter })
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

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
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

            <label className="text-sm">
              <div className="mb-1 font-medium">Fecha (YYYY-MM-DD)</div>
              <input
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={pickupDateFilter}
                onChange={(e) => setPickupDateFilter(e.target.value)}
                placeholder="Ej: 2026-02-08"
              />
            </label>
          </div>

          {!canUseBackend ? (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Offline/local: no se puede consultar.</div>
          ) : null}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Card className={pad}>
              <CardHeader title="Volumen por día" subtitle="Conteo de pendientes (según filtro)." />
              <div className="mt-4 h-64">
                {byDayChart.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">Sin datos para graficar.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byDayChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" hide />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="Pendientes" fill={'rgb(var(--agt-chart-2))'} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-7">
            <Card className={pad}>
              <CardHeader title="Sugerencias de consolidación" subtitle="Top grupos por coincidencia (día+municipio+producto)." />

              <div className="mt-4 space-y-2">
                {groups.map((g) => (
                  <div
                    key={g.key}
                    className="rounded-2xl border border-zinc-200/70 bg-white/60 p-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          {g.product} · {g.municipio}
                        </div>
                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                          {g.day} · {g.count} publicaciones
                          {g.producers ? ` · ${g.producers} productores` : ''}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold">
                          {Math.round(g.totalQty * 100) / 100} {g.sampleUnit || ''}
                        </div>
                        <button
                          type="button"
                          className="mt-2 rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                          onClick={() => {
                            setMunicipioFilter(g.municipio)
                            setProductFilter(g.product)
                            setPickupDateFilter(g.day)
                          }}
                        >
                          Enfocar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {groups.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">No hay coincidencias suficientes con el filtro actual.</div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
