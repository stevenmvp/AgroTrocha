import { useMemo, useState } from 'react'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function Card({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
      <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-300">{title}</div>
      <div className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">{value}</div>
      <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</div>
    </div>
  )
}

export function ReportsModule() {
  const cards = [
    { title: 'Pedidos procesados', value: '142', description: 'Pedidos completados esta semana' },
    { title: 'Solicitudes pendientes', value: '18', description: 'Atender en los próximos 2 días' },
    { title: 'Ahorro estimado', value: formatCurrency(820000), description: 'Comparado con tus precios de lista' },
    { title: 'Precio promedio mercado', value: formatCurrency(5300), description: 'Costos actuales para insumos' },
  ]

  const chartData = [
    { label: 'Lun', value: 45 },
    { label: 'Mar', value: 62 },
    { label: 'Mié', value: 54 },
    { label: 'Jue', value: 71 },
    { label: 'Vie', value: 88 },
    { label: 'Sáb', value: 68 },
    { label: 'Dom', value: 95 },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-4 lg:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.title} {...card} />
        ))}
      </div>

      <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Tendencia de pedidos</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Volumen diario de órdenes procesadas.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">Actualizado hace 2 minutos</span>
        </div>

        <div className="mt-6 flex items-end gap-3">
          {chartData.map((point) => (
            <div key={point.label} className="flex-1 text-center">
              <div className="mx-auto h-40 w-full max-w-[40px] rounded-full bg-emerald-200 dark:bg-emerald-500/30" style={{ height: `${point.value}%` }} />
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{point.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const sampleOrders = [
  { id: 'OT-1245', product: 'Café', quantity: 1200, unit: 'kg', status: 'En tránsito', price: 5200 },
  { id: 'OT-1246', product: 'Papa', quantity: 3400, unit: 'kg', status: 'Pendiente', price: 2300 },
  { id: 'OT-1247', product: 'Maíz', quantity: 1800, unit: 'kg', status: 'Confirmado', price: 3100 },
]

const sampleProducts = [
  { name: 'Fertilizante', stock: 510, location: 'Bodega 1' },
  { name: 'Semilla de maíz', stock: 220, location: 'Bodega 2' },
  { name: 'Plástico agro', stock: 80, location: 'Bodega 3' },
]

export function TablesModule() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Órdenes activas</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Lista de pedidos con estado y precio estimado.</p>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 pr-6 font-semibold">Pedido</th>
                <th className="py-3 pr-6 font-semibold">Producto</th>
                <th className="py-3 pr-6 font-semibold">Cantidad</th>
                <th className="py-3 pr-6 font-semibold">Estado</th>
                <th className="py-3 pr-6 font-semibold">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sampleOrders.map((order) => (
                <tr key={order.id}>
                  <td className="py-4 pr-6 font-semibold">{order.id}</td>
                  <td className="py-4 pr-6">{order.product}</td>
                  <td className="py-4 pr-6">{order.quantity} {order.unit}</td>
                  <td className="py-4 pr-6 text-emerald-700 dark:text-emerald-300">{order.status}</td>
                  <td className="py-4 pr-6">{formatCurrency(order.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Inventario rápido</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {sampleProducts.map((product) => (
            <div key={product.name} className="rounded-3xl border border-zinc-200/70 bg-zinc-50 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40">
              <div className="font-semibold">{product.name}</div>
              <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Stock: {product.stock}</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Ubicación: {product.location}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type JsonDatasetItem = Record<string, string | number>

const sampleJsonDatasets: Record<'Ordenes' | 'Productos' | 'Precios', JsonDatasetItem[]> = {
  Ordenes: [
    { id: 'OT-301', producto: 'Soya', cantidad: 560, precio: 4200 },
    { id: 'OT-302', producto: 'Arroz', cantidad: 1200, precio: 3300 },
  ],
  Productos: [
    { nombre: 'Herbicida', stock: 340, proveedor: 'Agroplus' },
    { nombre: 'Insecticida', stock: 150, proveedor: 'CampoSeguro' },
  ],
  Precios: [
    { producto: 'Mazorca', precio: 2800, fecha: '2026-05-30' },
    { producto: 'Trigo', precio: 3100, fecha: '2026-05-30' },
  ],
}

export function JsonLoaderModule() {
  const datasetNames = Object.keys(sampleJsonDatasets) as Array<keyof typeof sampleJsonDatasets>
  const [selectedDataset, setSelectedDataset] = useState<keyof typeof sampleJsonDatasets>(datasetNames[0])

  const items = sampleJsonDatasets[selectedDataset]
  const columns = useMemo(() => {
    if (!items || items.length === 0) return []
    return Object.keys(items[0])
  }, [items])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Carga JSON</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Selecciona un ejemplo de JSON para cargar información en el sistema.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {datasetNames.map((name) => (
              <button
                key={name}
                type="button"
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${selectedDataset === name ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300'}`}
                onClick={() => setSelectedDataset(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="py-3 pr-6 font-semibold">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {items.map((item: JsonDatasetItem, index: number) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column} className="py-4 pr-6">{String(item[column] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const sampleConsolidations = [
  { route: 'Medellín → Bogotá', cargo: 'Maíz', kilos: 2200, status: 'Consolidado' },
  { route: 'Cali → Pereira', cargo: 'Papa', kilos: 1700, status: 'En revisión' },
]

export function ConsolidacionesModule() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Consolidaciones sugeridas</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Consolidaciones de carga disponibles para ahorro y transporte compartido.</p>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 pr-6 font-semibold">Ruta</th>
                <th className="py-3 pr-6 font-semibold">Carga</th>
                <th className="py-3 pr-6 font-semibold">Kilos</th>
                <th className="py-3 pr-6 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sampleConsolidations.map((item) => (
                <tr key={item.route}>
                  <td className="py-4 pr-6 font-semibold">{item.route}</td>
                  <td className="py-4 pr-6">{item.cargo}</td>
                  <td className="py-4 pr-6">{item.kilos} kg</td>
                  <td className="py-4 pr-6 text-emerald-700 dark:text-emerald-300">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const samplePending = [
  { id: 'RQ-981', type: 'Revisión de carga', location: 'Buga', due: 'Hoy', priority: 'Alta' },
  { id: 'RQ-982', type: 'Confirmar precio', location: 'Sincelejo', due: 'Mañana', priority: 'Media' },
]

export function PendientesModule() {
  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Pendientes</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Tareas y solicitudes que requieren atención inmediata.</p>
      <div className="mt-6 space-y-4">
        {samplePending.map((item) => (
          <div key={item.id} className="rounded-3xl border border-zinc-200/70 bg-zinc-50 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold">{item.type}</div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.location}</div>
              </div>
              <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{item.priority}</div>
            </div>
            <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Vence: {item.due}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const sampleProductList = [
  { name: 'Fertilizante NPK', category: 'Insumo', available: 62, price: 8900 },
  { name: 'Semilla de arroz', category: 'Semilla', available: 130, price: 7200 },
  { name: 'Plástico de invernadero', category: 'Material', available: 38, price: 19000 },
]

export function ProductosModule() {
  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Productos</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Listado de productos y disponibilidad en almacén.</p>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
          <thead className="border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="py-3 pr-6 font-semibold">Producto</th>
              <th className="py-3 pr-6 font-semibold">Categoría</th>
              <th className="py-3 pr-6 font-semibold">Disponible</th>
              <th className="py-3 pr-6 font-semibold">Precio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sampleProductList.map((product) => (
              <tr key={product.name}>
                <td className="py-4 pr-6 font-semibold">{product.name}</td>
                <td className="py-4 pr-6">{product.category}</td>
                <td className="py-4 pr-6">{product.available}</td>
                <td className="py-4 pr-6">{formatCurrency(product.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const sampleMarket = [
  { item: 'Maíz', price: 3100, origin: 'Tolima', updated: '12:20' },
  { item: 'Papa', price: 2500, origin: 'Cundinamarca', updated: '11:50' },
  { item: 'Plátano', price: 2400, origin: 'Valle', updated: '12:05' },
]

export function MercadoModule() {
  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Mercado</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Precios de mercado para productos agrícolas.</p>
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
          <thead className="border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="py-3 pr-6 font-semibold">Producto</th>
              <th className="py-3 pr-6 font-semibold">Precio</th>
              <th className="py-3 pr-6 font-semibold">Origen</th>
              <th className="py-3 pr-6 font-semibold">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sampleMarket.map((item) => (
              <tr key={item.item}>
                <td className="py-4 pr-6 font-semibold">{item.item}</td>
                <td className="py-4 pr-6">{formatCurrency(item.price)}</td>
                <td className="py-4 pr-6">{item.origin}</td>
                <td className="py-4 pr-6">{item.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const sampleNotifications = [
  { title: 'Nueva orden recibida', message: 'Orden OT-301 ha sido registrada.' },
  { title: 'Precio actualizado', message: 'El precio del maíz subió 5% esta mañana.' },
  { title: 'Pendiente de revisión', message: 'Revisa la solicitud RQ-982 antes de las 17:00.' },
]

export function NotificacionesModule() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Notificaciones</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Mensajes recientes del sistema.</p>
      </div>
      {sampleNotifications.map((item) => (
        <div key={item.title} className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
          <div className="font-semibold text-zinc-950 dark:text-zinc-50">{item.title}</div>
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.message}</div>
        </div>
      ))}
    </div>
  )
}

const sampleAlerts = [
  { title: 'Alerta de clima', detail: 'Probabilidad de lluvia alta en Antioquia.' },
  { title: 'Control de calidad', detail: 'Revisar lote 18 de papa antes del despacho.' },
]

export function AlertasModule() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/50">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Alertas</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Indicadores críticos y avisos del sistema.</p>
      </div>
      {sampleAlerts.map((alert) => (
        <div key={alert.title} className="rounded-3xl border border-rose-200/70 bg-rose-50 p-5 text-rose-900 shadow-sm dark:border-rose-900/40 dark:bg-rose-900/10 dark:text-rose-100">
          <div className="font-semibold">{alert.title}</div>
          <div className="mt-2 text-sm">{alert.detail}</div>
        </div>
      ))}
    </div>
  )
}
