import { useMemo, useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { Schema } from '../../amplify/data/resource'
import { Card, CardHeader } from '../components/ui/Card'
import { getErrorMessage } from '../lib/getErrorMessage'

type GenericRecord = Record<string, unknown>
type Client = ReturnType<typeof generateClient<Schema>>

type ImportResult = {
  created: number
  skipped: number
  errors: string[]
}

type TableAdapter = {
  key: string
  label: string
  requiredFields: string[]
  dedupeKeys: string[]
  list: (client: Client) => Promise<GenericRecord[]>
  create: (client: Client, item: GenericRecord) => Promise<void>
}

function toList(data: unknown): GenericRecord[] {
  return Array.isArray(data) ? (data as GenericRecord[]) : []
}

function normalizeValue(value: unknown): string {
  if (value === null || typeof value === 'undefined') return ''
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function buildFingerprint(item: GenericRecord, keys: string[]): string {
  return keys.map((k) => `${k}:${normalizeValue(item[k])}`).join('|')
}

const TABLES: TableAdapter[] = [
  {
    key: 'Sequence',
    label: 'Sequence',
    requiredFields: ['id', 'value'],
    dedupeKeys: ['id'],
    list: async (c) => toList((await c.models.Sequence.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.Sequence.create(item as Schema['Sequence']['createType'])
    },
  },
  {
    key: 'User',
    label: 'User',
    requiredFields: ['id', 'name', 'role'],
    dedupeKeys: ['id'],
    list: async (c) => toList((await c.models.User.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.User.create(item as Schema['User']['createType'])
    },
  },
  {
    key: 'UserPublic',
    label: 'UserPublic',
    requiredFields: ['id', 'displayName'],
    dedupeKeys: ['id'],
    list: async (c) => toList((await c.models.UserPublic.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.UserPublic.create(item as Schema['UserPublic']['createType'])
    },
  },
  {
    key: 'Country',
    label: 'Country',
    requiredFields: ['code', 'name'],
    dedupeKeys: ['code'],
    list: async (c) => toList((await c.models.Country.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.Country.create(item as Schema['Country']['createType'])
    },
  },
  {
    key: 'Municipality',
    label: 'Municipality',
    requiredFields: ['countryCode', 'name'],
    dedupeKeys: ['countryCode', 'name', 'department'],
    list: async (c) => toList((await c.models.Municipality.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.Municipality.create(item as Schema['Municipality']['createType'])
    },
  },
  {
    key: 'Product',
    label: 'Product',
    requiredFields: ['name'],
    dedupeKeys: ['name'],
    list: async (c) => toList((await c.models.Product.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.Product.create(item as Schema['Product']['createType'])
    },
  },
  {
    key: 'TaxCategory',
    label: 'TaxCategory',
    requiredFields: ['id', 'countryCode', 'name'],
    dedupeKeys: ['countryCode', 'name', 'type'],
    list: async (c) => toList((await c.models.TaxCategory.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.TaxCategory.create(item as Schema['TaxCategory']['createType'])
    },
  },
  {
    key: 'TaxRate',
    label: 'TaxRate',
    requiredFields: ['categoryId', 'rate'],
    dedupeKeys: ['categoryId', 'region', 'effectiveFrom', 'rate'],
    list: async (c) => toList((await c.models.TaxRate.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.TaxRate.create(item as Schema['TaxRate']['createType'])
    },
  },
  {
    key: 'Provider',
    label: 'Provider',
    requiredFields: ['id', 'name'],
    dedupeKeys: ['name', 'providerType', 'countryCode', 'municipio'],
    list: async (c) => toList((await c.models.Provider.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.Provider.create(item as Schema['Provider']['createType'])
    },
  },
  {
    key: 'FreightRate',
    label: 'FreightRate',
    requiredFields: ['providerId', 'originCountryCode', 'originMunicipio', 'destCountryCode', 'destMunicipio', 'amount'],
    dedupeKeys: ['providerId', 'originMunicipio', 'destMunicipio', 'vehicleType', 'pricingUnit'],
    list: async (c) => toList((await c.models.FreightRate.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.FreightRate.create(item as Schema['FreightRate']['createType'])
    },
  },
  {
    key: 'Trip',
    label: 'Trip',
    requiredFields: ['id'],
    dedupeKeys: ['id'],
    list: async (c) => toList((await c.models.Trip.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.Trip.create(item as Schema['Trip']['createType'])
    },
  },
  {
    key: 'Order',
    label: 'Order',
    requiredFields: ['id', 'product', 'quantity', 'municipio'],
    dedupeKeys: ['orderNumber', 'product', 'pickupDate', 'municipio'],
    list: async (c) => toList((await c.models.Order.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.Order.create(item as Schema['Order']['createType'])
    },
  },
  {
    key: 'OrderPublic',
    label: 'OrderPublic',
    requiredFields: ['id', 'orderId', 'createdByUserId', 'createdByName', 'municipio', 'product', 'quantity'],
    dedupeKeys: ['orderId'],
    list: async (c) => toList((await c.models.OrderPublic.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.OrderPublic.create(item as Schema['OrderPublic']['createType'])
    },
  },
  {
    key: 'Request',
    label: 'Request',
    requiredFields: ['createdByUserId', 'type', 'status', 'title'],
    dedupeKeys: ['requestNumber', 'createdByUserId', 'type'],
    list: async (c) => toList((await c.models.Request.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.Request.create(item as Schema['Request']['createType'])
    },
  },
  {
    key: 'Alert',
    label: 'Alert',
    requiredFields: ['createdByUserId', 'severity', 'status', 'title'],
    dedupeKeys: ['createdByUserId', 'title', 'municipio'],
    list: async (c) => toList((await c.models.Alert.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.Alert.create(item as Schema['Alert']['createType'])
    },
  },
  {
    key: 'Notification',
    label: 'Notification',
    requiredFields: ['userId', 'title'],
    dedupeKeys: ['userId', 'title', 'createdAt'],
    list: async (c) => toList((await c.models.Notification.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.Notification.create(item as Schema['Notification']['createType'])
    },
  },
  {
    key: 'ExternalApi',
    label: 'ExternalApi',
    requiredFields: ['id', 'name', 'kind'],
    dedupeKeys: ['name', 'kind'],
    list: async (c) => toList((await c.models.ExternalApi.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.ExternalApi.create(item as Schema['ExternalApi']['createType'])
    },
  },
  {
    key: 'ExternalSyncJob',
    label: 'ExternalSyncJob',
    requiredFields: ['apiId', 'status', 'startedAt'],
    dedupeKeys: ['apiId', 'status', 'startedAt'],
    list: async (c) => toList((await c.models.ExternalSyncJob.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.ExternalSyncJob.create(item as Schema['ExternalSyncJob']['createType'])
    },
  },
  {
    key: 'PriceReference',
    label: 'PriceReference',
    requiredFields: ['product', 'date', 'price'],
    dedupeKeys: ['product', 'municipio', 'date', 'market'],
    list: async (c) => toList((await c.models.PriceReference.list({ limit: 1000 })).data),
    create: async (c, item) => {
      await c.models.PriceReference.create(item as Schema['PriceReference']['createType'])
    },
  },
]

async function runImport(client: Client, table: TableAdapter, rows: GenericRecord[]): Promise<ImportResult> {
  const existing = await table.list(client)
  const fingerprints = new Set(existing.map((item) => buildFingerprint(item, table.dedupeKeys)))

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i += 1) {
    const item = rows[i]
    const missing = table.requiredFields.filter((field) => {
      const value = item[field]
      return typeof value === 'undefined' || value === null || value === ''
    })

    if (missing.length > 0) {
      errors.push(`Fila ${i + 1}: faltan campos requeridos (${missing.join(', ')}).`)
      continue
    }

    const fp = buildFingerprint(item, table.dedupeKeys)
    if (fingerprints.has(fp)) {
      skipped += 1
      continue
    }

    try {
      await table.create(client, item)
      fingerprints.add(fp)
      created += 1
    } catch (error) {
      errors.push(`Fila ${i + 1}: ${getErrorMessage(error)}`)
    }
  }

  return { created, skipped, errors }
}

export function CargasJsonModule({
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
  const [selectedKey, setSelectedKey] = useState<string>(TABLES[0].key)
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [lastResult, setLastResult] = useState<string>('Aún no se ha cargado ningún archivo.')

  const canUseBackend = useMemo(() => amplifyReady && isOnline, [amplifyReady, isOnline])
  const pad = density === 'compact' ? 'p-3' : 'p-4'

  const selectedTable = useMemo(() => TABLES.find((t) => t.key === selectedKey) ?? TABLES[0], [selectedKey])

  async function importRows(rows: GenericRecord[]) {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const result = await runImport(client, selectedTable, rows)
      const summary = `Tabla ${selectedTable.label}: creados ${result.created}, omitidos por duplicado ${result.skipped}, errores ${result.errors.length}.`
      const detail = result.errors.length > 0 ? `${summary}\n\n${result.errors.slice(0, 20).join('\n')}` : summary
      setLastResult(detail)

      if (result.errors.length > 0) {
        onToast({ kind: 'error', message: summary })
      } else {
        onToast({ kind: 'success', message: summary })
      }
    } finally {
      setBusy(false)
    }
  }

  async function onImportFromFile() {
    if (!pickedFile) {
      onToast({ kind: 'error', message: 'Selecciona un archivo JSON.' })
      return
    }

    try {
      const raw = await pickedFile.text()
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        onToast({ kind: 'error', message: 'El archivo debe contener un arreglo JSON.' })
        return
      }
      await importRows(parsed as GenericRecord[])
    } catch (error) {
      onToast({ kind: 'error', message: `Archivo inválido: ${getErrorMessage(error)}` })
    }
  }

  async function onImportSeedForSelected() {
    try {
      const res = await fetch(`/seed-data/${selectedTable.key}.json`, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`No encontré el archivo seed-data/${selectedTable.key}.json`)
      }
      const parsed = (await res.json()) as unknown
      if (!Array.isArray(parsed)) {
        throw new Error('El archivo de seed no contiene un arreglo JSON.')
      }
      await importRows(parsed as GenericRecord[])
    } catch (error) {
      onToast({ kind: 'error', message: `No pude importar seed: ${getErrorMessage(error)}` })
    }
  }

  async function onImportAllSeeds() {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const summaries: string[] = []

      for (const table of TABLES) {
        try {
          const response = await fetch(`/seed-data/${table.key}.json`, { cache: 'no-store' })
          if (!response.ok) {
            summaries.push(`${table.label}: sin archivo seed.`)
            continue
          }

          const parsed = (await response.json()) as unknown
          if (!Array.isArray(parsed)) {
            summaries.push(`${table.label}: archivo inválido (no es array).`)
            continue
          }

          const result = await runImport(client, table, parsed as GenericRecord[])
          summaries.push(
            `${table.label}: +${result.created}, duplicados ${result.skipped}, errores ${result.errors.length}`
          )
        } catch (error) {
          summaries.push(`${table.label}: fallo (${getErrorMessage(error)}).`)
        }
      }

      const report = summaries.join('\n')
      setLastResult(report)
      onToast({ kind: 'success', message: 'Proceso de seeds completado. Revisa el reporte.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Card className={pad}>
            <CardHeader
              title="Carga de datos JSON"
              subtitle="Módulo temporal de pruebas. Inserta evitando duplicados por claves de negocio."
            />

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="text-sm">
                <div className="mb-1 font-medium">Tabla destino</div>
                <select
                  className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                >
                  {TABLES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium">Archivo JSON</div>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/40"
                />
              </label>

              <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50 p-3 text-xs dark:border-zinc-800/60 dark:bg-zinc-950/40">
                <div className="font-semibold">Validaciones en esta tabla</div>
                <div className="mt-1">Requeridos: {selectedTable.requiredFields.join(', ')}</div>
                <div className="mt-1">Clave anti-duplicado: {selectedTable.dedupeKeys.join(' + ')}</div>
              </div>

              <button
                type="button"
                onClick={onImportFromFile}
                disabled={busy}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
              >
                {busy ? 'Procesando…' : 'Subir archivo JSON'}
              </button>

              <button
                type="button"
                onClick={onImportSeedForSelected}
                disabled={busy}
                className="rounded-2xl border border-zinc-200/70 bg-white/70 px-4 py-3 text-sm font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
              >
                {busy ? 'Procesando…' : 'Subir seed de esta tabla'}
              </button>

              <button
                type="button"
                onClick={onImportAllSeeds}
                disabled={busy}
                className="rounded-2xl border border-zinc-200/70 bg-zinc-100 px-4 py-3 text-sm font-semibold dark:border-zinc-800/60 dark:bg-zinc-900/40"
              >
                {busy ? 'Procesando…' : 'Subir todos los seeds'}
              </button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card className={pad}>
            <CardHeader
              title="Resultado de importación"
              subtitle="Resumen de creados, omitidos por duplicado y errores de validación/escritura."
            />

            <pre className="mt-4 max-h-[38rem] overflow-auto rounded-2xl border border-zinc-200/70 bg-zinc-50 p-3 text-xs dark:border-zinc-800/60 dark:bg-zinc-950/40">
              {lastResult}
            </pre>
          </Card>
        </div>
      </div>
    </main>
  )
}
