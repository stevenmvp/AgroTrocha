import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'

type Role = 'PRODUCTOR' | 'TRANSPORTISTA'

type OrderDraft = {
  rawText: string
  municipio?: string
}

type ParsedOrder = {
  product: string
  quantity: number
  unit?: string
  pickupDate?: string
  municipio: string
}

type PendingQueueItem = {
  id: string
  createdAt: string
  payload: OrderDraft
}

type AppProps = {
  amplifyReady: boolean
  auth?: {
    username: string | null
    signOut: (() => void) | null
  }
}

const QUEUE_KEY = 'agrotrocha.pendingOrders.v1'

function loadQueue(): PendingQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PendingQueueItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveQueue(queue: PendingQueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

function makeId() {
  return crypto.randomUUID()
}

function safeParseJsonObject(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const slice = text.slice(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch {
    return null
  }
}

function parseOrderLocally(input: string): ParsedOrder | null {
  // MVP: heurística simple para seguir avanzando offline.
  // Ejemplo: "Tengo 30 bultos de cebolla para el viernes en Aquitania"
  const lower = input.toLowerCase()
  const qtyMatch = lower.match(/(\d+(?:[.,]\d+)?)/)
  const quantity = qtyMatch ? Number(qtyMatch[1].replace(',', '.')) : NaN
  const unitMatch = lower.match(/\b(bultos?|toneladas?|cargas?|kg|kilos?)\b/)
  const unit = unitMatch?.[1]
  const municipioMatch = lower.match(/\ben\s+([a-záéíóúñ\s]+)$/i)
  const municipio = municipioMatch?.[1]?.trim()

  const productMatch = lower.match(/de\s+([a-záéíóúñ\s]+?)\s+(para|el|en)\b/)
  const product = productMatch?.[1]?.trim()

  if (!product || !municipio || !Number.isFinite(quantity)) return null
  return {
    product: product.replace(/^\w/, (c) => c.toUpperCase()),
    quantity,
    unit,
    municipio: municipio.replace(/^\w/, (c) => c.toUpperCase()),
  }
}

async function analyzeTextWithAI(text: string): Promise<ParsedOrder | null> {
  // Intentar usar Amplify (Query custom -> Lambda -> Bedrock). Si no está configurado,
  // caemos a parser local para seguir avanzando offline.
  try {
    const client = generateClient<Schema>()
    const resp = await client.queries.analyzeOrderFromText({ text })
    const data = resp.data
    if (!data || (Array.isArray(data.missing) && data.missing.length > 0)) {
      return parseOrderLocally(text)
    }
    if (!data.product || !data.quantity || !data.municipio) return parseOrderLocally(text)
    return {
      product: data.product,
      quantity: data.quantity,
      unit: data.unit ?? undefined,
      pickupDate: data.pickupDate ?? undefined,
      municipio: data.municipio,
    }
  } catch {
    return parseOrderLocally(text)
  }
}

function App({ amplifyReady, auth }: AppProps) {
  const [role, setRole] = useState<Role>('PRODUCTOR')
  const [rawText, setRawText] = useState('Tengo 30 bultos de cebolla para el viernes en Aquitania')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queue, setQueue] = useState<PendingQueueItem[]>(() => loadQueue())
  const [lastParsed, setLastParsed] = useState<ParsedOrder | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    saveQueue(queue)
  }, [queue])

  const pendingCount = queue.length
  const headerBadge = useMemo(() => {
    if (!isOnline) return { label: 'Offline', className: 'bg-amber-100 text-amber-800' }
    return { label: 'Online', className: 'bg-emerald-100 text-emerald-800' }
  }, [isOnline])

  async function onRegister() {
    setError(null)
    setLastParsed(null)
    const text = rawText.trim()
    if (!text) {
      setError('Escribe (o dicta) un mensaje primero.')
      return
    }

    try {
      const parsed = await analyzeTextWithAI(text)
      if (!parsed) {
        setError('No pude extraer datos. Prueba con: “Tengo 30 bultos de cebolla para el viernes en Aquitania”.')
        return
      }
      setLastParsed(parsed)

      // Intento online real: si Amplify está listo y hay conectividad, creamos Order en Data.
      if (isOnline && amplifyReady) {
        try {
          const client = generateClient<Schema>()
          const current = await getCurrentUser()
          const aiAnalysis = JSON.stringify(parsed)
          await client.models.Order.create({
            userId: current.userId,
            product: parsed.product,
            quantity: parsed.quantity,
            unit: parsed.unit,
            pickupDate: parsed.pickupDate,
            municipio: parsed.municipio,
            status: 'PENDIENTE',
            aiAnalysis,
          })
        } catch {
          // Si falla la escritura remota, caemos a cola offline.
          setQueue((prev) => [
            {
              id: makeId(),
              createdAt: new Date().toISOString(),
              payload: { rawText: text, municipio: parsed.municipio },
            },
            ...prev,
          ])
        }
        return
      }

      // Offline o sin backend: encolar.
      setQueue((prev) => [
        {
          id: makeId(),
          createdAt: new Date().toISOString(),
          payload: { rawText: text, municipio: parsed.municipio },
        },
        ...prev,
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-lg font-semibold leading-none">AgroTrocha</div>
            <div className="text-xs text-slate-600">Logística colaborativa rural (MVP)</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${headerBadge.className}`}>{headerBadge.label}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">Pendientes: {pendingCount}</span>
            {amplifyReady ? (
              <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800">Backend listo</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Modo local</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-4">
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Perfil</h2>
            <div className="flex items-center gap-2">
              {auth?.username ? <span className="text-xs text-slate-600">{auth.username}</span> : null}
              {auth?.signOut ? (
                <button
                  type="button"
                  className="rounded-xl border bg-white px-3 py-2 text-sm"
                  onClick={auth.signOut}
                >
                  Salir
                </button>
              ) : null}
              <select
                className="rounded-xl border bg-white px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="PRODUCTOR">Productor</option>
                <option value="TRANSPORTISTA">Transportista</option>
              </select>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            En Fase 2 el rol/municipio vendrá de Cognito (atributos + permisos).
          </p>
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Registrar carga</h2>
            <button
              type="button"
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
              onClick={onRegister}
            >
              Simular micrófono
            </button>
          </div>

          <label className="mt-3 block text-sm font-medium text-slate-700">Mensaje</label>
          <textarea
            className="mt-2 w-full resize-none rounded-2xl border bg-white p-3 text-sm leading-5 outline-none focus:ring-2 focus:ring-slate-300"
            rows={3}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Ej: Tengo 30 bultos de cebolla para el viernes en Aquitania"
          />

          {error ? <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

          {lastParsed ? (
            <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <div className="font-semibold">Datos extraídos</div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div><span className="text-emerald-900/70">Producto:</span> {lastParsed.product}</div>
                <div><span className="text-emerald-900/70">Cantidad:</span> {lastParsed.quantity} {lastParsed.unit ?? ''}</div>
                <div className="col-span-2"><span className="text-emerald-900/70">Municipio:</span> {lastParsed.municipio}</div>
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-xs text-slate-600">
            Regla offline: si no hay conexión, se guarda en LocalStorage y se sincroniza luego.
          </p>
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Matching (básico)</h2>
          <p className="mt-2 text-sm text-slate-600">
            Próximo: sugerir consolidación por municipio+fecha (y luego geocoordenadas).
          </p>
          <div className="mt-3 space-y-2">
            {queue.slice(0, 5).map((item) => {
              const parsed = safeParseJsonObject(item.payload.rawText)
              return (
                <div key={item.id} className="rounded-xl border bg-slate-50 p-3 text-sm">
                  <div className="font-medium text-slate-900">{item.payload.municipio ?? '—'}</div>
                  <div className="mt-1 text-slate-700">{item.payload.rawText}</div>
                  {parsed ? <div className="mt-2 text-xs text-slate-500">JSON detectado en texto</div> : null}
                </div>
              )
            })}
            {queue.length === 0 ? <div className="text-sm text-slate-600">Aún no hay cargas registradas.</div> : null}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
