import { useMemo, useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { Schema } from '../../amplify/data/resource'
import { Card, CardHeader } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { getErrorMessage } from '../lib/getErrorMessage'

type TableLoadResult = {
  key: string
  label: string
  ok: boolean
  count: number
  sample: unknown[]
  error?: string
}

type TableConfig = {
  key: string
  label: string
  load: (client: ReturnType<typeof generateClient<Schema>>) => Promise<{ data?: unknown[] }>
}

const TABLES: TableConfig[] = [
  { key: 'Sequence', label: 'Sequence', load: (c) => c.models.Sequence.list({ limit: 25 }) },
  { key: 'User', label: 'User', load: (c) => c.models.User.list({ limit: 25 }) },
  { key: 'UserPublic', label: 'UserPublic', load: (c) => c.models.UserPublic.list({ limit: 25 }) },
  { key: 'Country', label: 'Country', load: (c) => c.models.Country.list({ limit: 25 }) },
  { key: 'Municipality', label: 'Municipality', load: (c) => c.models.Municipality.list({ limit: 25 }) },
  { key: 'Product', label: 'Product', load: (c) => c.models.Product.list({ limit: 25 }) },
  { key: 'TaxCategory', label: 'TaxCategory', load: (c) => c.models.TaxCategory.list({ limit: 25 }) },
  { key: 'TaxRate', label: 'TaxRate', load: (c) => c.models.TaxRate.list({ limit: 25 }) },
  { key: 'Provider', label: 'Provider', load: (c) => c.models.Provider.list({ limit: 25 }) },
  { key: 'FreightRate', label: 'FreightRate', load: (c) => c.models.FreightRate.list({ limit: 25 }) },
  { key: 'Order', label: 'Order', load: (c) => c.models.Order.list({ limit: 25 }) },
  { key: 'OrderPublic', label: 'OrderPublic', load: (c) => c.models.OrderPublic.list({ limit: 25 }) },
  { key: 'Trip', label: 'Trip', load: (c) => c.models.Trip.list({ limit: 25 }) },
  { key: 'Request', label: 'Request', load: (c) => c.models.Request.list({ limit: 25 }) },
  { key: 'Alert', label: 'Alert', load: (c) => c.models.Alert.list({ limit: 25 }) },
  { key: 'Notification', label: 'Notification', load: (c) => c.models.Notification.list({ limit: 25 }) },
  { key: 'ExternalApi', label: 'ExternalApi', load: (c) => c.models.ExternalApi.list({ limit: 25 }) },
  { key: 'ExternalSyncJob', label: 'ExternalSyncJob', load: (c) => c.models.ExternalSyncJob.list({ limit: 25 }) },
  { key: 'PriceReference', label: 'PriceReference', load: (c) => c.models.PriceReference.list({ limit: 25 }) },
]

export function TablasModule({
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
  const [results, setResults] = useState<TableLoadResult[]>([])
  const [selected, setSelected] = useState<string>('')

  const canUseBackend = amplifyReady && isOnline
  const pad = density === 'compact' ? 'p-3' : 'p-4'

  const selectedResult = useMemo(() => results.find((r) => r.key === selected) ?? null, [results, selected])

  async function refreshAll() {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const loaded = await Promise.all(
        TABLES.map(async (table) => {
          try {
            const res = await table.load(client)
            const data = Array.isArray(res.data) ? res.data : []
            return {
              key: table.key,
              label: table.label,
              ok: true,
              count: data.length,
              sample: data.slice(0, 3),
            } satisfies TableLoadResult
          } catch (error) {
            return {
              key: table.key,
              label: table.label,
              ok: false,
              count: 0,
              sample: [],
              error: getErrorMessage(error),
            } satisfies TableLoadResult
          }
        })
      )

      setResults(loaded)
      if (!selected && loaded.length > 0) setSelected(loaded[0].key)

      const okCount = loaded.filter((x) => x.ok).length
      onToast({ kind: 'success', message: `Tablas consultadas: ${okCount}/${loaded.length}.` })
    } finally {
      setBusy(false)
    }
  }

  const okTables = results.filter((r) => r.ok).length
  const failTables = results.filter((r) => !r.ok).length
  const totalRows = results.reduce((acc, item) => acc + item.count, 0)

  return (
    <main className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Backend" value={amplifyReady ? 'Listo' : 'Local'} tone={amplifyReady ? 'brand' : 'neutral'} />
          <StatCard label="Conexión" value={isOnline ? 'Online' : 'Offline'} tone={isOnline ? 'good' : 'warn'} />
          <StatCard label="Tablas OK" value={okTables} tone={okTables > 0 ? 'good' : 'neutral'} />
          <StatCard label="Filas (muestra)" value={totalRows} />
        </div>

        <Card className={pad}>
          <CardHeader
            title="Inspector temporal de tablas"
            subtitle="Módulo de prueba para validar lecturas de todas las tablas de Amplify Data."
            right={
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
                onClick={refreshAll}
                disabled={busy}
              >
                {busy ? 'Consultando...' : 'Consultar todas'}
              </button>
            }
          />

          {!canUseBackend ? (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Sin conexión o backend no disponible: no se pueden consultar tablas.
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className="mt-4 text-xs text-zinc-600 dark:text-zinc-300">
              Con errores: {failTables}. Las tablas con permisos restringidos pueden fallar según el rol del usuario.
            </div>
          ) : null}
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Card className={pad}>
              <CardHeader title="Estado por tabla" subtitle="Resultado de lectura (limit 25)." />
              <div className="mt-4 space-y-2">
                {results.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSelected(r.key)}
                    className={
                      'w-full rounded-2xl border p-3 text-left text-sm ' +
                      (selected === r.key
                        ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                        : 'border-zinc-200/70 bg-white/60 dark:border-zinc-800/60 dark:bg-zinc-950/30')
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{r.label}</div>
                      <div className={r.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                        {r.ok ? 'OK' : 'ERROR'}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Filas leídas: {r.count}</div>
                    {!r.ok && r.error ? <div className="mt-1 text-xs text-rose-700 dark:text-rose-300">{r.error}</div> : null}
                  </button>
                ))}
                {results.length === 0 ? (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">Todavía no hay resultados. Pulsa "Consultar todas".</div>
                ) : null}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-6">
            <Card className={pad}>
              <CardHeader
                title={selectedResult ? `Muestra: ${selectedResult.label}` : 'Muestra de registros'}
                subtitle="Primeros 3 registros devueltos por la tabla seleccionada."
              />

              <div className="mt-4">
                {selectedResult ? (
                  selectedResult.ok ? (
                    <pre className="max-h-[28rem] overflow-auto rounded-2xl border border-zinc-200/70 bg-zinc-50 p-3 text-xs dark:border-zinc-800/60 dark:bg-zinc-950/40">
                      {JSON.stringify(selectedResult.sample, null, 2)}
                    </pre>
                  ) : (
                    <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 p-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
                      {selectedResult.error ?? 'No se pudo leer la tabla.'}
                    </div>
                  )
                ) : (
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">Selecciona una tabla para ver su muestra.</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
