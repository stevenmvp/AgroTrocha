import { useEffect, useMemo, useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { Schema } from '../../amplify/data/resource'
import { ChatModule } from './Chat'
import { loadProfile } from './Perfil'

type PetitionItem = {
  id: string
  createdAt: string
  createdBy?: string | null
  externalId?: string | null
  product?: string
  quantity?: number
  unit?: string
  pickupDate?: string
  municipio?: string
  missing?: string[]
  notes?: string
  assignedTo?: string | null
  priceOffer?: number | null
  status: 'OPEN' | 'MATCHED' | 'COMPLETED' | 'CANCELLED'
  sent: boolean
}

const STORAGE_KEY = 'agrotrocha.peticiones.v1'

function loadPetitions(): PetitionItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PetitionItem[]
    return Array.isArray(parsed)
      ? parsed.map((p) => ({ ...p, missing: Array.isArray(p.missing) ? p.missing : [], status: p.status ?? 'OPEN' }))
      : []
  } catch {
    return []
  }
}

function savePetitions(items: PetitionItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function PeticionesModule({ amplifyReady, isOnline, username, onToast }: { amplifyReady: boolean; isOnline: boolean; username?: string | null; onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void }) {
  const [items, setItems] = useState<PetitionItem[]>(() => loadPetitions())
  const [product, setProduct] = useState('')
  const [quantity, setQuantity] = useState<number | undefined>(undefined)
  const [unit, setUnit] = useState('kg')
  const [pickupDate, setPickupDate] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [missingText, setMissingText] = useState('')
  const [busy, setBusy] = useState(false)
  const [chatFor, setChatFor] = useState<string | null>(null)

  const canSync = amplifyReady && isOnline
  const profile = loadProfile()
  const isProducer = profile.role === 'PRODUCTOR'

  useEffect(() => {
    if (!canSync) return
    const pending = items.filter((i) => !i.sent)
    if (pending.length === 0) return

    let cancelled = false
    async function flush() {
      for (const p of pending) {
        if (cancelled) return
        try {
          await sendPetitionToBackend(p)
        } catch (e) {
          // keep trying later
        }
      }
    }
    flush()
    return () => {
      cancelled = true
    }
  }, [canSync])

  useEffect(() => savePetitions(items), [items])

  const summary = useMemo(() => `${items.filter((i) => i.status === 'OPEN').length} abiertas · ${items.filter((i) => i.status === 'MATCHED').length} emparejadas`, [items])

  async function createPetition() {
    if (!product.trim()) return onToast({ kind: 'error', message: 'Producto requerido' })

    const p: PetitionItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: username ?? null,
      product: product.trim(),
      quantity: quantity ?? undefined,
      unit,
      pickupDate: pickupDate || undefined,
      municipio: municipio || undefined,
      missing: missingText ? missingText.split(',').map((s) => s.trim()).filter(Boolean) : [],
      notes: undefined,
      assignedTo: null,
      priceOffer: null,
      status: 'OPEN',
      sent: false,
    }

    setItems((prev) => [p, ...prev])
    setProduct('')
    setQuantity(undefined)
    setUnit('kg')
    setPickupDate('')
    setMunicipio('')
    setMissingText('')

    if (!canSync) return onToast({ kind: 'info', message: 'Peticiones guardadas localmente. Se enviarán cuando haya conexión.' })

    await sendPetitionToBackend(p)
  }

  async function sendPetitionToBackend(p: PetitionItem) {
    setBusy(true)
    try {
      const client = generateClient<Schema>()
      if (client.mutations?.createOrderSecure) {
        const res = await client.mutations.createOrderSecure({
          product: p.product ?? '',
          quantity: p.quantity ?? 0,
          unit: p.unit,
          pickupDate: p.pickupDate,
          municipio: p.municipio ?? '',
          aiAnalysis: undefined,
        })
        // assume resolver returns orderId string
        const orderId = typeof res === 'string' ? res : res?.data ?? null
        setItems((prev) => prev.map((it) => (it.id === p.id ? { ...it, sent: true, externalId: orderId ?? null } : it)))
        onToast({ kind: 'success', message: 'Petición guardada en backend.' })
      } else if (client.mutations?.createRequestSecure) {
        // fallback to Request-based API
        const body = {
          type: 'OTHER',
          title: `Peticiones: ${p.product ?? 'producto'}`,
          details: p.notes || undefined,
          payloadJson: JSON.stringify({ product: p.product, quantity: p.quantity, unit: p.unit, pickupDate: p.pickupDate, municipio: p.municipio, missing: p.missing }),
        }
        await client.mutations.createRequestSecure(body)
        setItems((prev) => prev.map((it) => (it.id === p.id ? { ...it, sent: true } : it)))
        onToast({ kind: 'success', message: 'Petición enviada al backend.' })
      } else {
        throw new Error('No backend mutation available')
      }
    } catch (e) {
      console.warn('peticion send failed', e)
      onToast({ kind: 'error', message: 'No se pudo enviar la petición. Queda en cola.' })
    } finally {
      setBusy(false)
    }
  }

  function joinPetition(id: string, who: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, assignedTo: who, status: 'MATCHED' } : it)))
    onToast({ kind: 'success', message: 'Te has unido a la petición.' })
  }

  return (
    <div className="space-y-6">
      {isProducer ? (
        <section className="rounded-3xl border p-6 bg-white/70">
          <div className="text-xl font-semibold">Peticiones</div>
          <div className="text-sm text-zinc-600">Conecta productores y transportistas — guarda toda la información siguiendo el esquema de datos.</div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input placeholder="Producto" value={product} onChange={(e) => setProduct(e.target.value)} className="rounded-2xl border px-3 py-2" />
            <input placeholder="Cantidad" value={quantity ?? ''} onChange={(e) => setQuantity(Number(e.target.value || 0) || undefined)} className="rounded-2xl border px-3 py-2" />
            <input placeholder="Unidad" value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-2xl border px-3 py-2" />
            <input placeholder="Fecha de recolección" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="rounded-2xl border px-3 py-2" />
            <input placeholder="Municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)} className="rounded-2xl border px-3 py-2" />
            <input placeholder="Items faltantes (coma separated)" value={missingText} onChange={(e) => setMissingText(e.target.value)} className="rounded-2xl border px-3 py-2" />
          </div>

          <div className="mt-4 flex gap-2">
            <button disabled={busy} onClick={createPetition} className="rounded-2xl bg-emerald-600 px-4 py-2 text-white">{busy ? 'Enviando…' : 'Crear petición'}</button>
            <div className="px-3 py-2 text-sm text-zinc-600">{summary}</div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border p-6 bg-white/70">
          <div className="text-xl font-semibold">Peticiones</div>
          <div className="text-sm text-zinc-600">Estás viendo las peticiones públicas — usa el botón "Ofrecer servicio" para unirte.</div>
        </section>
      )}

      <section className="rounded-3xl border p-6 bg-white/70">
        <div className="text-lg font-semibold">Listado</div>
        <div className="mt-3 space-y-3">
          {items.map((it) => (
            <div key={it.id} className="rounded-2xl border p-3">
              <div className="font-semibold">{it.product} {it.quantity ? `· ${it.quantity} ${it.unit}` : ''}</div>
              <div className="text-xs text-zinc-500">{it.municipio ?? 'varios'} · {new Date(it.createdAt).toLocaleString()}</div>
              <div className="mt-2 text-sm">{it.missing?.join(', ')}</div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => joinPetition(it.id, username ?? 'Transportista')} className="rounded-2xl border px-3 py-2">Ofrecer servicio</button>
                <button onClick={() => setChatFor(it.id)} className="rounded-2xl border px-3 py-2">Chat</button>
                <div className="text-sm text-zinc-600">Estado: {it.status}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      {chatFor ? <ChatModule petitionId={chatFor} username={username} onClose={() => setChatFor(null)} /> : null}
    </div>
  )
}
