import { useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { getErrorMessage } from '../lib/getErrorMessage'
import { Card, CardHeader } from '../components/ui/Card'
import type { NavKey } from '../components/BottomNav'
import { setNavIntent } from '../state/navIntent'

const UNITS: Array<NonNullable<Schema['Product']['type']['defaultUnit']>> = ['bultos', 'toneladas', 'cargas', 'kg', 'unidades']

export function ProductosModule({
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
  onNavigate?: (key: NavKey) => void
}) {
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Schema['Product']['type'][]>([])

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [defaultUnit, setDefaultUnit] = useState<(typeof UNITS)[number]>('bultos')
  const [active, setActive] = useState(true)

  const canUseBackend = useMemo(() => amplifyReady && isOnline, [amplifyReady, isOnline])

  async function refresh() {
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const res = await client.models.Product.list({ limit: 200 })
      setItems(res.data ?? [])
      onToast({ kind: 'success', message: `Productos cargados: ${res.data?.length ?? 0}.` })
    } catch (e) {
      onToast({ kind: 'error', message: `No pude cargar productos: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    const n = name.trim()
    if (!n) {
      onToast({ kind: 'error', message: 'Nombre es requerido.' })
      return
    }
    if (!canUseBackend) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      await client.models.Product.create({
        name: n,
        category: category.trim() || undefined,
        defaultUnit,
        active,
      })
      setName('')
      setCategory('')
      setDefaultUnit('bultos')
      setActive(true)
      onToast({ kind: 'success', message: 'Producto creado.' })
      await refresh()
    } catch (e) {
      onToast({ kind: 'error', message: `No pude crear producto: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Card className={density === 'compact' ? 'p-3' : 'p-4'}>
            <CardHeader
              title="Catálogo de productos"
              subtitle="Estandariza los nombres y unidades para publicar." 
              right={
                <button
                  type="button"
                  className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  onClick={refresh}
                  disabled={busy}
                >
                  {busy ? 'Cargando…' : 'Actualizar'}
                </button>
              }
            />

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-zinc-200/70 bg-white/60 p-3 text-sm shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        {(p.category ?? '').trim() ? `Categoría: ${p.category}` : 'Sin categoría'}
                        {p.defaultUnit ? ` · Unidad: ${p.defaultUnit}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span
                        className={
                          'rounded-full px-2 py-1 text-[11px] font-semibold ' +
                          (p.active === false ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900')
                        }
                      >
                        {p.active === false ? 'Inactivo' : 'Activo'}
                      </span>
                      <button
                        type="button"
                        className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-[11px] font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
                        onClick={() => {
                          setNavIntent({ kind: 'dashboardFilters', product: p.name })
                          onNavigate?.('dashboard')
                        }}
                      >
                        Ver en Panel
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {items.length === 0 ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-300">Aún no hay productos cargados.</div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-5">
          <Card className={density === 'compact' ? 'p-3' : 'p-4'}>
            <CardHeader
              title="Crear producto"
              subtitle="Ahora cualquier usuario autenticado puede crear (update/delete siguen siendo ADMIN/STAFF)."
            />

            <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="text-sm">
              <div className="mb-1 font-medium">Nombre</div>
              <input
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Cebolla cabezona"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Categoría (opcional)</div>
              <input
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ej: Hortalizas"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Unidad por defecto</div>
              <select
                className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={defaultUnit}
                onChange={(e) => setDefaultUnit(e.target.value as (typeof UNITS)[number])}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Activo
            </label>

            <button
              type="button"
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
              onClick={create}
              disabled={busy}
            >
              {busy ? 'Guardando…' : 'Crear'}
            </button>
          </div>
          </Card>
        </div>
      </div>
    </main>
  )
}
