import { useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { Schema } from '../../amplify/data/resource'

type SolicitudesModuleProps = {
  amplifyReady: boolean
  isOnline: boolean
  username?: string | null
  onToast: (toast: { kind: 'success' | 'error' | 'info'; message: string }) => void
}

export function SolicitudesModule({ onToast }: SolicitudesModuleProps) {
  // Minimal technical support module — "Solicitudes" para reportar problemas técnicos
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendSupport() {
    if (!title.trim()) return onToast({ kind: 'error', message: 'Título requerido.' })
    setBusy(true)
    try {
      const client = generateClient<Schema>()
      await client.mutations.createRequestSecure({ type: 'SUPPORT', title: title.trim(), details: details.trim() || undefined })
      setTitle('')
      setDetails('')
      onToast({ kind: 'success', message: 'Solicitud técnica enviada.' })
    } catch (e) {
      console.warn('support send failed', e)
      onToast({ kind: 'error', message: 'No se pudo enviar la solicitud técnica.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border p-6 bg-white/70">
        <div className="text-xl font-semibold">Solicitudes (Soporte técnico)</div>
        <div className="text-sm text-zinc-600">Reporta problemas técnicos o pide ayuda sobre la aplicación.</div>

        <div className="mt-4 space-y-3">
          <input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-2xl border px-3 py-2 w-full" />
          <textarea placeholder="Detalles" value={details} onChange={(e) => setDetails(e.target.value)} className="rounded-2xl border px-3 py-2 w-full" rows={4} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={sendSupport} className="rounded-2xl bg-emerald-600 px-4 py-2 text-white">{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
          </div>
        </div>
      </section>
    </div>
  )
}

