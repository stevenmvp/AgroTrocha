import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { getErrorMessage } from '../lib/getErrorMessage'

type PriceRef = Schema['PriceReference']['type']

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function inDateRange(date: string, from: string, to: string): boolean {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return String(Math.round(n * 100) / 100)
}

function computeStats(rows: PriceRef[]) {
  if (rows.length === 0) return null

  const sorted = rows
    .slice()
    .filter((r) => typeof r.date === 'string' && r.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null
  const prices = rows.map((r) => Number(r.price ?? 0)).filter((x) => Number.isFinite(x))
  if (prices.length === 0) return null

  let sum = 0
  let min = prices[0]
  let max = prices[0]
  for (const p of prices) {
    sum += p
    if (p < min) min = p
    if (p > max) max = p
  }

  const unitCounts = new Map<string, number>()
  for (const r of rows) {
    const u = typeof r.unit === 'string' && r.unit.trim() ? r.unit.trim() : ''
    if (!u) continue
    unitCounts.set(u, (unitCounts.get(u) ?? 0) + 1)
  }
  const unit = Array.from(unitCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    count: rows.length,
    latestDate: typeof latest?.date === 'string' ? latest.date : null,
    latestPrice: latest && typeof latest.price === 'number' ? latest.price : Number(latest?.price ?? NaN),
    avg: sum / prices.length,
    min,
    max,
    unit,
  }
}

export function SipsaModule({
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
  const [items, setItems] = useState<PriceRef[]>([])

  const [adminApis, setAdminApis] = useState<Schema['ExternalApi']['type'][]>([])
  const [adminApisLoaded, setAdminApisLoaded] = useState(false)
  const [adminApisError, setAdminApisError] = useState<string | null>(null)
  const [selectedApiId, setSelectedApiId] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [adminNote, setAdminNote] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [lastSyncOutput, setLastSyncOutput] = useState<string>('')

  const [municipio, setMunicipio] = useState('')
  const [productA, setProductA] = useState('')
  const [productB, setProductB] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [searchProducts, setSearchProducts] = useState('')
  const [searchMunicipios, setSearchMunicipios] = useState('')

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
      const res = await client.models.PriceReference.list({ limit: 1000 })
      setItems(res.data ?? [])
      onToast({ kind: 'success', message: `Cargados: ${res.data?.length ?? 0}.` })
    } catch (e) {
      onToast({ kind: 'error', message: `No pude cargar PriceReference: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  async function loadAdminApis() {
    if (!canUseBackend) return
    try {
      const client = generateClient<Schema>()
      const res = await client.models.ExternalApi.list({ limit: 100 })
      const list = res.data ?? []
      setAdminApis(list)
      setAdminApisLoaded(true)
      setAdminApisError(null)
      setAdminNote(null)
      if (!selectedApiId && list.length > 0 && typeof list[0].id === 'string') setSelectedApiId(list[0].id)
    } catch (e) {
      setAdminApisLoaded(true)
      setAdminApis([])
      const msg = getErrorMessage(e)
      setAdminApisError(msg)
      setAdminNote({ kind: 'error', message: `No pude listar ExternalApi: ${msg}` })
    }
  }

  async function createDefaultSipsaApi() {
    if (!canUseBackend) return
    setCreateBusy(true)
    try {
      const client = generateClient<Schema>()
      const created = await client.models.ExternalApi.create({
        name: 'SIPSA (DANE)',
        kind: 'PRECIOS',
        baseUrl: 'https://appweb.dane.gov.co/sipsaWS/SrvSipsaUpraBeanService',
        authType: 'NONE',
        enabled: true,
        configJson: JSON.stringify({
          forceHttps: true,
          maxRecordsPerMethod: 300,
          methods: [
            'promediosSipsaCiudad',
            'consultarInsumosSipsaMesMadr',
            'promediosSipsaSemanaMadr',
            'promediosSipsaMesMadr',
            'promedioAbasSipsaMesMadr',
          ],
        }),
      })

      const id = created.data?.id
      await loadAdminApis()
      if (typeof id === 'string' && id) setSelectedApiId(id)
      onToast({ kind: 'success', message: 'Fuente SIPSA creada.' })
      setAdminNote({ kind: 'success', message: 'Fuente SIPSA creada.' })
    } catch (e) {
      const msg = getErrorMessage(e)
      onToast({ kind: 'error', message: `No pude crear ExternalApi SIPSA: ${msg}` })
      setAdminNote({ kind: 'error', message: `No pude crear ExternalApi SIPSA: ${msg}` })
    } finally {
      setCreateBusy(false)
    }
  }

  async function syncNow() {
    if (!canUseBackend) return
    if (!selectedApiId) {
      onToast({ kind: 'info', message: 'Selecciona una fuente (ExternalApi) primero.' })
      return
    }
    setSyncBusy(true)
    try {
      const client = generateClient<Schema>()
      const resp = await client.mutations.syncExternalApiNow({ apiId: selectedApiId })
      const out = String(resp.data ?? '')
      setLastSyncOutput(out)
      onToast({ kind: 'success', message: out ? `Sync: ${out.slice(0, 120)}` : 'Sync ejecutado.' })
      setAdminNote({ kind: 'success', message: 'Sync ejecutado.' })
      await refresh()
    } catch (e) {
      const msg = getErrorMessage(e)
      onToast({ kind: 'error', message: `No pude sincronizar SIPSA: ${msg}` })
      setAdminNote({ kind: 'error', message: `No pude sincronizar SIPSA: ${msg}` })
    } finally {
      setSyncBusy(false)
    }
  }

  useEffect(() => {
    if (!canUseBackend) {
      // load seed data from public/seed-data as fallback
      let cancelled = false
      ;(async () => {
        try {
          const res = await fetch('/seed-data/PriceReference.json')
          if (!res.ok) return
          const data = (await res.json()) as PriceRef[]
          if (!cancelled) setItems(data)
        } catch {
          // ignore
        }
      })()
      return () => {
        cancelled = true
      }
    }
    void refresh()
    void loadAdminApis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseBackend])

  const available = useMemo(() => {
    const products = new Map<string, number>()
    const municipios = new Map<string, number>()

    for (const r of items) {
      const p = typeof r.product === 'string' ? r.product.trim() : ''
      const m = typeof r.municipio === 'string' ? r.municipio.trim() : ''
      if (p) products.set(p, (products.get(p) ?? 0) + 1)
      if (m) municipios.set(m, (municipios.get(m) ?? 0) + 1)
    }

    const productList = Array.from(products.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

    const municipioList = Array.from(municipios.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

    return { productList, municipioList }
  }, [items])

  const filtered = useMemo(() => {
    const mKey = normalizeKey(municipio)
    const pAKey = normalizeKey(productA)

    return items
      .filter((r) => {
        const date = typeof r.date === 'string' ? r.date : ''
        if (fromDate || toDate) {
          if (!date) return false
          if (!inDateRange(date, fromDate, toDate)) return false
        }

        if (mKey) {
          const rowM = normalizeKey(String(r.municipio ?? ''))
          if (rowM !== mKey) return false
        }

        if (pAKey) {
          const rowP = normalizeKey(String(r.product ?? ''))
          if (rowP !== pAKey) return false
        }

        return true
      })
      .slice()
      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
  }, [items, municipio, productA, fromDate, toDate])

  const baseForComparison = useMemo(() => {
    const mKey = normalizeKey(municipio)
    return items.filter((r) => {
      if (mKey && normalizeKey(String(r.municipio ?? '')) !== mKey) return false
      const date = typeof r.date === 'string' ? r.date : ''
      if (fromDate || toDate) {
        if (!date) return false
        if (!inDateRange(date, fromDate, toDate)) return false
      }
      return true
    })
  }, [items, municipio, fromDate, toDate])

  const comparison = useMemo(() => {
    const aKey = normalizeKey(productA)
    const bKey = normalizeKey(productB)
    const aRows = aKey ? baseForComparison.filter((r) => normalizeKey(String(r.product ?? '')) === aKey) : []
    const bRows = bKey ? baseForComparison.filter((r) => normalizeKey(String(r.product ?? '')) === bKey) : []
    const aStats = computeStats(aRows)
    const bStats = computeStats(bRows)
    const deltaAvg = aStats && bStats ? aStats.avg - bStats.avg : null
    return { aStats, bStats, deltaAvg }
  }, [baseForComparison, productA, productB])

  const shownProducts = useMemo(() => {
    const q = normalizeKey(searchProducts)
    return available.productList.filter((x) => !q || normalizeKey(x.name).includes(q)).slice(0, 60)
  }, [available.productList, searchProducts])

  const shownMunicipios = useMemo(() => {
    const q = normalizeKey(searchMunicipios)
    return available.municipioList.filter((x) => !q || normalizeKey(x.name).includes(q)).slice(0, 60)
  }, [available.municipioList, searchMunicipios])

  const maxRows = 200
  const rowsToShow = filtered.slice(0, maxRows)

  const selectCls =
    'w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40'

  return (
    <main className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Backend" value={amplifyReady ? 'Listo' : 'Local'} tone={amplifyReady ? 'brand' : 'neutral'} />
          <StatCard label="Conexión" value={isOnline ? 'Online' : 'Offline'} tone={isOnline ? 'good' : 'warn'} />
          <StatCard label="Registros" value={items.length} />
          <StatCard label="Filtrados" value={filtered.length} />
        </div>

        <Card className={pad}>
          <CardHeader
            title="SIPSA / Precios"
            subtitle="Tablas, filtros y comparación sobre PriceReference (SIPSA y otras fuentes)."
            right={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  onClick={refresh}
                  disabled={busy}
                >
                  {busy ? '…' : 'Recargar'}
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
                  onClick={syncNow}
                  disabled={syncBusy || !canUseBackend}
                  title="Admin: dispara syncExternalApiNow"
                >
                  {syncBusy ? 'Sincronizando…' : 'Sincronizar'}
                </button>
              </div>
            }
          />

          {!canUseBackend ? (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Offline/local: no se puede consultar.</div>
          ) : null}

          {canUseBackend && items.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-white/60 p-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/30">
              <div className="font-semibold">No hay datos todavía</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                Este módulo lee <span className="font-semibold">PriceReference</span>. Si está vacío, debes sincronizar desde SIPSA (DANE)
                usando una <span className="font-semibold">ExternalApi</span> y la operación admin <span className="font-semibold">syncExternalApiNow</span>.
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-sm md:col-span-2">
                  <div className="mb-1 text-xs font-semibold text-zinc-700 dark:text-zinc-200">Fuente (ExternalApi)</div>
                  <select
                    className={selectCls}
                    value={selectedApiId}
                    onChange={(e) => setSelectedApiId(e.target.value)}
                    disabled={!adminApisLoaded || adminApis.length === 0}
                  >
                    <option value="">(Sin fuentes disponibles)</option>
                    {adminApis.map((a) => (
                      <option key={a.id} value={a.id}>
                        {String(a.name ?? a.id)}
                      </option>
                    ))}
                  </select>
                  {adminApisError ? (
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      No pude listar ExternalApi (probable falta de permisos ADMIN/STAFF): {adminApisError}
                    </div>
                  ) : null}
                  {adminApisLoaded && !adminApisError && adminApis.length === 0 ? (
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      No hay fuentes creadas aún. Si el botón <span className="font-semibold">Crear SIPSA</span> falla, revisa que el backend esté actualizado
                      (schema) y que tu usuario tenga permisos <span className="font-semibold">ADMIN/STAFF</span>.
                    </div>
                  ) : null}
                </label>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    className="w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-xs font-semibold disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                    onClick={createDefaultSipsaApi}
                    disabled={createBusy || !canUseBackend}
                    title="Admin: crea una ExternalApi SIPSA por defecto"
                  >
                    {createBusy ? 'Creando…' : 'Crear SIPSA'}
                  </button>
                </div>
              </div>

              {adminNote ? (
                <div
                  className={
                    'mt-3 rounded-xl border p-3 text-xs ' +
                    (adminNote.kind === 'error'
                      ? 'border-rose-200/70 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200'
                      : adminNote.kind === 'success'
                        ? 'border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
                        : 'border-zinc-200/70 bg-white/60 text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-950/30 dark:text-zinc-200')
                  }
                >
                  {adminNote.message}
                </div>
              ) : null}

              {lastSyncOutput.trim() ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Última respuesta de sync</div>
                  <textarea className={selectCls + ' mt-2 min-h-[96px]'} value={lastSyncOutput} readOnly />
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Card className={pad}>
              <CardHeader title="Disponibles" subtitle="Lista de productos y municipios encontrados en PriceReference." />

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold">Productos</div>
                  <input
                    className={
                      'mt-2 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40'
                    }
                    value={searchProducts}
                    onChange={(e) => setSearchProducts(e.target.value)}
                    placeholder="Buscar producto…"
                  />
                  <div className="mt-2 max-h-64 space-y-2 overflow-auto pr-1">
                    {shownProducts.map((x) => (
                      <button
                        key={x.name}
                        type="button"
                        className={
                          'w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold ' +
                          (normalizeKey(productA) === normalizeKey(x.name)
                            ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950'
                            : 'border-zinc-200/70 bg-white/70 text-zinc-900 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-50')
                        }
                        onClick={() => setProductA(x.name)}
                        title="Usar como Producto A"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate">{x.name}</span>
                          <span className="shrink-0 text-[11px] opacity-80">{x.count}</span>
                        </div>
                      </button>
                    ))}
                    {shownProducts.length === 0 ? (
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">Sin coincidencias.</div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold">Municipios</div>
                  <input
                    className={
                      'mt-2 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40'
                    }
                    value={searchMunicipios}
                    onChange={(e) => setSearchMunicipios(e.target.value)}
                    placeholder="Buscar municipio…"
                  />
                  <div className="mt-2 max-h-64 space-y-2 overflow-auto pr-1">
                    {shownMunicipios.map((x) => (
                      <button
                        key={x.name}
                        type="button"
                        className={
                          'w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold ' +
                          (normalizeKey(municipio) === normalizeKey(x.name)
                            ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950'
                            : 'border-zinc-200/70 bg-white/70 text-zinc-900 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-50')
                        }
                        onClick={() => setMunicipio(x.name)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate">{x.name}</span>
                          <span className="shrink-0 text-[11px] opacity-80">{x.count}</span>
                        </div>
                      </button>
                    ))}
                    {shownMunicipios.length === 0 ? (
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">Sin coincidencias.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>

            <Card className={pad + ' mt-4'}>
              <CardHeader title="Filtros" subtitle="Filtra por municipio, producto y rango de fechas." />

              <div className="mt-4 grid grid-cols-1 gap-3">
                <label className="text-sm">
                  <div className="mb-1 font-medium">Municipio</div>
                  <select className={selectCls} value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
                    <option value="">(Todos)</option>
                    {available.municipioList.slice(0, 400).map((x) => (
                      <option key={x.name} value={x.name}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Producto A</div>
                  <select className={selectCls} value={productA} onChange={(e) => setProductA(e.target.value)}>
                    <option value="">(Todos)</option>
                    {available.productList.slice(0, 600).map((x) => (
                      <option key={x.name} value={x.name}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Producto B (comparación)</div>
                  <select className={selectCls} value={productB} onChange={(e) => setProductB(e.target.value)}>
                    <option value="">(Ninguno)</option>
                    {available.productList.slice(0, 600).map((x) => (
                      <option key={x.name} value={x.name}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 font-medium">Desde</div>
                    <input className={selectCls} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 font-medium">Hasta</div>
                    <input className={selectCls} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                    onClick={() => {
                      setMunicipio('')
                      setProductA('')
                      setProductB('')
                      setFromDate('')
                      setToDate('')
                    }}
                  >
                    Limpiar filtros
                  </button>
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">Mostrando {Math.min(filtered.length, maxRows)} de {filtered.length}</div>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-7">
            <Card className={pad}>
              <CardHeader title="Comparación" subtitle="Resumen lado a lado por producto (en el municipio/rango seleccionado)." />

              <div className="mt-4 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-600 dark:text-zinc-300">
                      <th className="py-2 pr-3">Métrica</th>
                      <th className="py-2 pr-3">Producto A</th>
                      <th className="py-2 pr-3">Producto B</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-900 dark:text-zinc-50">
                    <tr className="border-t border-zinc-200/70 dark:border-zinc-800/60">
                      <td className="py-2 pr-3 font-semibold">Nombre</td>
                      <td className="py-2 pr-3">{productA || '—'}</td>
                      <td className="py-2 pr-3">{productB || '—'}</td>
                    </tr>
                    <tr className="border-t border-zinc-200/70 dark:border-zinc-800/60">
                      <td className="py-2 pr-3 font-semibold">Registros</td>
                      <td className="py-2 pr-3">{comparison.aStats?.count ?? '—'}</td>
                      <td className="py-2 pr-3">{comparison.bStats?.count ?? '—'}</td>
                    </tr>
                    <tr className="border-t border-zinc-200/70 dark:border-zinc-800/60">
                      <td className="py-2 pr-3 font-semibold">Último precio</td>
                      <td className="py-2 pr-3">
                        {comparison.aStats ? `${formatNumber(comparison.aStats.latestPrice)} ${comparison.aStats.unit ?? ''}`.trim() : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {comparison.bStats ? `${formatNumber(comparison.bStats.latestPrice)} ${comparison.bStats.unit ?? ''}`.trim() : '—'}
                      </td>
                    </tr>
                    <tr className="border-t border-zinc-200/70 dark:border-zinc-800/60">
                      <td className="py-2 pr-3 font-semibold">Fecha (último)</td>
                      <td className="py-2 pr-3">{comparison.aStats?.latestDate ?? '—'}</td>
                      <td className="py-2 pr-3">{comparison.bStats?.latestDate ?? '—'}</td>
                    </tr>
                    <tr className="border-t border-zinc-200/70 dark:border-zinc-800/60">
                      <td className="py-2 pr-3 font-semibold">Promedio</td>
                      <td className="py-2 pr-3">{comparison.aStats ? formatNumber(comparison.aStats.avg) : '—'}</td>
                      <td className="py-2 pr-3">{comparison.bStats ? formatNumber(comparison.bStats.avg) : '—'}</td>
                    </tr>
                    <tr className="border-t border-zinc-200/70 dark:border-zinc-800/60">
                      <td className="py-2 pr-3 font-semibold">Mín / Máx</td>
                      <td className="py-2 pr-3">{comparison.aStats ? `${formatNumber(comparison.aStats.min)} / ${formatNumber(comparison.aStats.max)}` : '—'}</td>
                      <td className="py-2 pr-3">{comparison.bStats ? `${formatNumber(comparison.bStats.min)} / ${formatNumber(comparison.bStats.max)}` : '—'}</td>
                    </tr>
                    <tr className="border-t border-zinc-200/70 dark:border-zinc-800/60">
                      <td className="py-2 pr-3 font-semibold">Δ Promedio (A - B)</td>
                      <td className="py-2 pr-3" colSpan={2}>
                        {comparison.deltaAvg == null ? '—' : formatNumber(comparison.deltaAvg)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className={pad + ' mt-4'}>
              <CardHeader title="Tabla" subtitle="Registros detallados (máx 200 filas según filtros)." />

              <div className="mt-4 overflow-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-600 dark:text-zinc-300">
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Producto</th>
                      <th className="py-2 pr-3">Municipio</th>
                      <th className="py-2 pr-3">Mercado/Fuente</th>
                      <th className="py-2 pr-3">Precio</th>
                      <th className="py-2 pr-3">Unidad</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-900 dark:text-zinc-50">
                    {rowsToShow.map((r) => (
                      <tr key={r.id} className="border-t border-zinc-200/70 dark:border-zinc-800/60">
                        <td className="py-2 pr-3 whitespace-nowrap">{String(r.date ?? '—')}</td>
                        <td className="py-2 pr-3 max-w-[240px] truncate">{String(r.product ?? '—')}</td>
                        <td className="py-2 pr-3 max-w-[160px] truncate">{String(r.municipio ?? '—')}</td>
                        <td className="py-2 pr-3 max-w-[260px] truncate">{String(r.market ?? '—')}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{String(r.price ?? '—')}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{String(r.unit ?? '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {rowsToShow.length === 0 ? (
                  <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Sin datos para esos filtros.</div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
