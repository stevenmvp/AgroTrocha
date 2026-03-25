import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { fetchAuthSession } from 'aws-amplify/auth'
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

type RequestQueueItem = {
  id: string
  createdAt: string
  payload: {
    type: 'ROLE_CHANGE' | 'PROVIDER_ONBOARDING' | 'SUPPORT' | 'DATA_FIX' | 'OTHER'
    title: string
    details?: string
    payloadJson?: string
  }
}

const REQ_QUEUE_KEY = 'agrotrocha.requestQueue.v1'
const PRICE_CACHE_KEY = 'agrotrocha.priceReferenceCache.v1'

function makeId() {
  return crypto.randomUUID()
}

function loadReqQueue(): RequestQueueItem[] {
  try {
    const raw = localStorage.getItem(REQ_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RequestQueueItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveReqQueue(queue: RequestQueueItem[]) {
  localStorage.setItem(REQ_QUEUE_KEY, JSON.stringify(queue))
}

function loadPriceCache(): Schema['PriceReference']['type'][] {
  try {
    const raw = localStorage.getItem(PRICE_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Schema['PriceReference']['type'][]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function savePriceCache(rows: Schema['PriceReference']['type'][]) {
  localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(rows))
}

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
  const [syncBusy, setSyncBusy] = useState(false)
  const [reqBusy, setReqBusy] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [items, setItems] = useState<Schema['PriceReference']['type'][]>(() => loadPriceCache())
  const [priceApis, setPriceApis] = useState<Schema['ExternalApi']['type'][]>([])
  const [selectedApiId, setSelectedApiId] = useState('')

  const [municipio, setMunicipio] = useState('')
  const [product, setProduct] = useState('')

  const canUseBackend = amplifyReady && isOnline
  const pad = density === 'compact' ? 'p-3' : 'p-4'

  async function resolveRole() {
    try {
      const session = await fetchAuthSession()
      const payload = session.tokens?.idToken?.payload
      const groupsRaw = payload?.['cognito:groups']
      const customRoleRaw = payload?.['custom:role']

      const groups = Array.isArray(groupsRaw)
        ? groupsRaw.map((g) => String(g))
        : typeof groupsRaw === 'string'
          ? groupsRaw
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          : []

      const customRole = typeof customRoleRaw === 'string' ? customRoleRaw.toUpperCase() : ''
      const admin = groups.includes('ADMIN') || groups.includes('STAFF') || customRole === 'ADMIN'
      setIsAdmin(admin)
      return admin
    } catch {
      setIsAdmin(false)
      return false
    }
  }

  useEffect(() => {
    const intent = consumeNavIntent()
    if (intent?.kind === 'dashboardFilters') {
      if (typeof intent.municipio === 'string') setMunicipio(intent.municipio)
      if (typeof intent.product === 'string') setProduct(intent.product)
    }
  }, [])

  async function refresh() {
    if (!canUseBackend) {
      const cached = loadPriceCache()
      setItems(cached)
      onToast({ kind: 'info', message: cached.length > 0 ? `Mostrando ${cached.length} registros desde caché local.` : 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const res = await client.models.PriceReference.list({ limit: 500 })
      const rows = res.data ?? []

      setItems(rows)
      if (rows.length > 0) savePriceCache(rows)

      const admin = await resolveRole()
      if (admin) {
        try {
          const apiRes = await client.models.ExternalApi.list({ limit: 100 })
          const apis = (apiRes.data ?? []).filter((x) => x.kind === 'PRECIOS' && x.enabled !== false)
          setPriceApis(apis)
          if (!selectedApiId && apis.length > 0) {
            const sispaApi = apis.find((x) => /sipsa|sispa/i.test(String(x.name ?? '')))
            setSelectedApiId(sispaApi?.id ?? apis[0].id)
          }
        } catch {
          setPriceApis([])
        }
      } else {
        setPriceApis([])
      }

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

  async function runPriceSyncNow() {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }
    if (!selectedApiId) {
      onToast({ kind: 'info', message: 'Selecciona una API de precios.' })
      return
    }
    if (!isAdmin) {
      onToast({ kind: 'info', message: 'Solo ADMIN/STAFF puede ejecutar sync directo.' })
      return
    }

    setSyncBusy(true)
    try {
      const client = generateClient<Schema>()
      await client.mutations.syncExternalApiNow({ apiId: selectedApiId })
      onToast({ kind: 'success', message: 'Sync de API solicitado. Revisa ExternalSyncJob/PriceReference.' })
      await refresh()
    } catch (e) {
      onToast({ kind: 'error', message: `No pude ejecutar sync (requiere rol admin/staff): ${getErrorMessage(e)}` })
    } finally {
      setSyncBusy(false)
    }
  }

  async function createPriceSyncRequest() {
    const title = `Solicitud de actualización de precios${product.trim() ? `: ${product.trim()}` : ''}`
    const details = `Municipio=${municipio.trim() || 'N/A'}; Producto=${product.trim() || 'N/A'}; origen=Mercado`
    const payloadJson = JSON.stringify({
      kind: 'PRICE_SYNC_REQUEST',
      municipio: municipio.trim() || null,
      product: product.trim() || null,
      selectedApiId: selectedApiId || null,
      requestedAt: new Date().toISOString(),
    })

    if (!canUseBackend) {
      const queue = loadReqQueue()
      queue.unshift({
        id: makeId(),
        createdAt: new Date().toISOString(),
        payload: { type: 'DATA_FIX', title, details, payloadJson },
      })
      saveReqQueue(queue)
      onToast({ kind: 'info', message: 'Offline: solicitud de precios guardada en cola.' })
      return
    }

    setReqBusy(true)
    try {
      const client = generateClient<Schema>()
      await client.mutations.createRequestSecure({
        type: 'DATA_FIX',
        title,
        details,
        payloadJson,
      })
      onToast({ kind: 'success', message: 'Solicitud de actualización de precios creada.' })
    } catch (e) {
      onToast({ kind: 'error', message: `No pude crear la solicitud: ${getErrorMessage(e)}` })
    } finally {
      setReqBusy(false)
    }
  }

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
            subtitle="Precios de alimentos desde SISPA (fuente externa) almacenados en PriceReference."
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

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm md:col-span-2">
              <div className="mb-1 font-medium">API externa de precios (admin)</div>
              <select
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={selectedApiId}
                onChange={(e) => setSelectedApiId(e.target.value)}
                disabled={!canUseBackend || syncBusy || reqBusy || !isAdmin}
              >
                <option value="">Selecciona una API PRECIOS (ideal: SISPA)</option>
                {priceApis.map((api) => (
                  <option key={api.id} value={api.id}>
                    {api.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-xs font-semibold disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                onClick={runPriceSyncNow}
                disabled={!canUseBackend || syncBusy || reqBusy || !isAdmin}
              >
                {syncBusy ? 'Solicitando sync SISPA...' : 'Ejecutar sync SISPA ahora'}
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-3 py-3 text-xs font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
                onClick={createPriceSyncRequest}
                disabled={syncBusy || reqBusy}
              >
                {reqBusy ? 'Creando solicitud...' : 'Generar solicitud'}
              </button>
            </div>
          </div>

          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
            {isAdmin
              ? 'Perfil ADMIN/STAFF: puedes ejecutar sync directo o generar solicitud.'
              : 'Perfil usuario: puedes consultar precios y generar solicitud. El sync directo es solo ADMIN/STAFF.'}
          </div>
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
              <CardHeader title="Tabla de precios" subtitle="Últimos 25 registros según filtros." />

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-xs md:text-sm">
                  <thead>
                    <tr>
                      <th className="sticky top-0 bg-zinc-100 px-3 py-2 font-semibold dark:bg-zinc-900">Fecha</th>
                      <th className="sticky top-0 bg-zinc-100 px-3 py-2 font-semibold dark:bg-zinc-900">Producto</th>
                      <th className="sticky top-0 bg-zinc-100 px-3 py-2 font-semibold dark:bg-zinc-900">Municipio</th>
                      <th className="sticky top-0 bg-zinc-100 px-3 py-2 font-semibold dark:bg-zinc-900">Mercado</th>
                      <th className="sticky top-0 bg-zinc-100 px-3 py-2 font-semibold dark:bg-zinc-900">Precio</th>
                      <th className="sticky top-0 bg-zinc-100 px-3 py-2 font-semibold dark:bg-zinc-900">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered
                      .slice()
                      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
                      .slice(0, 25)
                      .map((r) => (
                        <tr key={r.id} className="border-b border-zinc-200/70 dark:border-zinc-800/60">
                          <td className="px-3 py-2">{r.date ?? '—'}</td>
                          <td className="px-3 py-2 font-medium">{r.product ?? '—'}</td>
                          <td className="px-3 py-2">{r.municipio ?? '—'}</td>
                          <td className="px-3 py-2">{r.market ?? '—'}</td>
                          <td className="px-3 py-2">{r.price ?? '—'}</td>
                          <td className="px-3 py-2">{r.unit ?? '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {filtered.length === 0 ? (
                <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">No hay datos en PriceReference para los filtros actuales.</div>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
