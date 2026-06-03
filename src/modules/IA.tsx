import { useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { analyzeTextWithAI } from '../lib/orderAnalyze'
import { getErrorMessage } from '../lib/getErrorMessage'

type Msg = {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: string
}

const KEY = 'agrotrocha.aiChat.v1'
const REQ_QUEUE_KEY = 'agrotrocha.requestQueue.v1'

function makeId() {
  return crypto.randomUUID()
}

function loadChat(): Msg[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Msg[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveChat(next: Msg[]) {
  localStorage.setItem(KEY, JSON.stringify(next))
}

type RequestQueueItem = {
  id: string
  createdAt: string
  payload: {
    type: 'ROLE_CHANGE' | 'PROVIDER_ONBOARDING' | 'SUPPORT' | 'DATA_FIX' | 'OTHER'
    title: string
    details?: string
  }
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

function localReply(text: string) {
  const lower = text.toLowerCase()
  if (lower.includes('cómo') || lower.includes('como')) {
    return 'Puedes registrar un pendiente desde “Pendientes”. Si estás offline, quedará en cola local.'
  }
  if (lower.includes('impuesto') || lower.includes('iva')) {
    return 'Los impuestos están modelados (TaxCategory/TaxRate). Falta una pantalla admin para gestionarlos.'
  }
  return 'Estoy en modo local. Cuando el backend esté listo, podrás chatear con IA usando Bedrock.'
}

export function IAModule({
  amplifyReady,
  isOnline,
  sttEnabled,
  ttsEnabled,
  onToast,
}: {
  amplifyReady: boolean
  isOnline: boolean
  sttEnabled: boolean
  ttsEnabled: boolean
  onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void
}) {
  const [messages, setMessages] = useState<Msg[]>(() => loadChat())
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)

  const [action, setAction] = useState<null | 'createPending' | 'createRequest'>(null)
  const [pendingText, setPendingText] = useState('Tengo 30 bultos de cebolla para el viernes en Aquitania')
  const [reqTitle, setReqTitle] = useState('')
  const [reqDetails, setReqDetails] = useState('')

  const canUseBackend = amplifyReady && isOnline

  const hint = useMemo(() => {
    if (!isOnline) return 'Offline: el chat se guarda local.'
    if (!amplifyReady) return 'Sin backend: respuestas locales.'
    return 'IA lista: consulta a Bedrock (cuando esté desplegado).'
  }, [amplifyReady, isOnline])

  function push(msg: Msg) {
    setMessages((prev) => {
      const next = [...prev, msg]
      saveChat(next)
      return next
    })
  }

  function speak(text: string) {
    if (!ttsEnabled) return
    if (typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'es-ES'
      window.speechSynthesis.speak(u)
    } catch {
      // ignore
    }
  }

  function startDictation() {
    if (!sttEnabled) {
      onToast({ kind: 'info', message: 'Dictado desactivado en Configuración.' })
      return
    }
    type SpeechRecognitionCtor = new () => {
      lang: string
      interimResults: boolean
      continuous: boolean
      start: () => void
      onresult: ((event: unknown) => void) | null
      onerror: ((event: unknown) => void) | null
      onend: (() => void) | null
    }

    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }

    const SpeechRecognition = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SpeechRecognition) {
      onToast({ kind: 'info', message: 'Este navegador no soporta dictado.' })
      return
    }

    try {
      const rec = new SpeechRecognition()
      rec.lang = 'es-ES'
      rec.interimResults = true
      rec.continuous = false

      setListening(true)
      let finalText = ''

      rec.onresult = (e) => {
        const ev = e as {
          resultIndex: number
          results: ArrayLike<{
            isFinal: boolean
            0?: { transcript?: unknown }
          }>
        }
        let interim = ''
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i]
          const t = String(res?.[0]?.transcript ?? '')
          if (res.isFinal) finalText += t
          else interim += t
        }
        setInput((prev) => {
          const base = prev.trim().length ? prev.trim() + ' ' : ''
          return (base + (finalText || interim)).trim()
        })
      }

      rec.onerror = () => {
        setListening(false)
        onToast({ kind: 'error', message: 'Error de dictado.' })
      }

      rec.onend = () => {
        setListening(false)
      }

      rec.start()
    } catch {
      setListening(false)
      onToast({ kind: 'error', message: 'No pude iniciar dictado.' })
    }
  }

  async function createPendingFromIA() {
    const text = pendingText.trim()
    if (!text) {
      onToast({ kind: 'error', message: 'Escribe el texto del pendiente.' })
      return
    }
    if (!amplifyReady || !isOnline) {
      onToast({ kind: 'info', message: 'Necesitas estar online y con backend listo.' })
      return
    }

    setBusy(true)
    try {
      const parsed = await analyzeTextWithAI(text)
      if (!parsed) {
        onToast({ kind: 'error', message: 'No pude extraer datos del texto.' })
        return
      }
      const client = generateClient<Schema>()
      await client.mutations.createOrderSecure({
        product: parsed.product,
        quantity: parsed.quantity,
        unit: parsed.unit,
        pickupDate: parsed.pickupDate,
        municipio: parsed.municipio,
        aiAnalysis: JSON.stringify(parsed),
      })
      onToast({ kind: 'success', message: 'Pendiente creado desde IA.' })
      setAction(null)
    } catch (e) {
      onToast({ kind: 'error', message: `No pude crear pendiente desde IA: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  async function createRequestFromIA() {
    const title = reqTitle.trim()
    const details = reqDetails.trim()
    if (!title) {
      onToast({ kind: 'error', message: 'Título es requerido.' })
      return
    }
    if (!amplifyReady || !isOnline) {
      const queue = loadReqQueue()
      const item: RequestQueueItem = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        payload: { type: 'SUPPORT', title, details: details || undefined },
      }
      saveReqQueue([item, ...queue])
      onToast({ kind: 'info', message: 'Offline: solicitud guardada en cola.' })
      setReqTitle('')
      setReqDetails('')
      setAction(null)
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      await client.mutations.createRequestSecure({
        type: 'SUPPORT',
        title,
        details: details || undefined,
      })
      onToast({ kind: 'success', message: 'Solicitud creada desde IA.' })
      setReqTitle('')
      setReqDetails('')
      setAction(null)
    } catch (e) {
      onToast({ kind: 'error', message: `No pude crear solicitud desde IA: ${getErrorMessage(e)}` })
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text) return

    setInput('')
    push({ id: makeId(), role: 'user', text, at: new Date().toISOString() })

    setBusy(true)
    try {
      if (canUseBackend) {
        const client = generateClient<Schema>()
        const resp = await client.queries.askAI({ text })
        const out = String(resp.data ?? '')
        const assistantText = out || 'Sin respuesta'
        push({ id: makeId(), role: 'assistant', text: assistantText, at: new Date().toISOString() })
        speak(assistantText)
      } else {
        const assistantText = localReply(text)
        push({ id: makeId(), role: 'assistant', text: assistantText, at: new Date().toISOString() })
        speak(assistantText)
      }
    } catch (e) {
      onToast({ kind: 'error', message: `No pude consultar la IA: ${getErrorMessage(e)}. Usando respuesta local.` })
      const assistantText = localReply(text)
      push({ id: makeId(), role: 'assistant', text: assistantText, at: new Date().toISOString() })
      speak(assistantText)
    } finally {
      setBusy(false)
    }
  }

  function clearChat() {
    setMessages([])
    saveChat([])
    onToast({ kind: 'success', message: 'Chat limpiado.' })
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-4 md:max-w-6xl">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Pregúntale a la IA</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{hint}</p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold dark:border-zinc-800/60 dark:bg-zinc-950/40"
              onClick={clearChat}
            >
              Limpiar
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  'rounded-2xl border p-3 text-sm ' +
                  (m.role === 'user'
                    ? 'ml-8 border-zinc-900 bg-zinc-900 text-white dark:border-zinc-800 dark:bg-zinc-950'
                    : 'mr-8 border-zinc-200/70 bg-zinc-50 text-zinc-900 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-50')
                }
              >
                {m.text}
              </div>
            ))}
            {messages.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Haz una pregunta para comenzar.</div>
            ) : null}
          </div>

          <div className="mt-3 flex items-end gap-2">
            <textarea
              className="min-h-[44px] flex-1 resize-none rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: ¿Cómo registro una carga?"
            />
            <button
              type="button"
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm font-semibold disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              disabled={busy || listening}
              onClick={startDictation}
              title="Dictar"
            >
              {listening ? (
                <div className="agt-bars" aria-label="Escuchando">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="agt-bar bg-zinc-900 dark:bg-zinc-50" />
                  ))}
                </div>
              ) : (
                'Voz'
              )}
            </button>
            <button
              type="button"
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
              disabled={busy}
              onClick={send}
            >
              {busy ? '...' : 'Enviar'}
            </button>
          </div>

          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
            Voz: depende del soporte del navegador. Próximo: AWS Transcribe + acciones más avanzadas.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
          <h2 className="text-base font-semibold">Acciones</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Escalable: la IA puede disparar acciones del sistema.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={
                'rounded-xl border px-3 py-3 text-sm font-semibold ' +
                (action === 'createPending'
                  ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950'
                  : 'border-zinc-200/70 bg-white/70 text-zinc-900 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-50')
              }
              onClick={() => setAction(action === 'createPending' ? null : 'createPending')}
            >
              Crear pendiente
            </button>
            <button
              type="button"
              className={
                'rounded-xl border px-3 py-3 text-sm font-semibold ' +
                (action === 'createRequest'
                  ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950'
                  : 'border-zinc-200/70 bg-white/70 text-zinc-900 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-50')
              }
              onClick={() => setAction(action === 'createRequest' ? null : 'createRequest')}
            >
              Crear solicitud
            </button>
          </div>

          {action === 'createPending' ? (
            <div className="mt-3 rounded-2xl border border-zinc-200/70 bg-white/70 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40">
              <div className="text-sm font-semibold">Nuevo pendiente</div>
              <textarea
                className="mt-2 w-full resize-none rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                rows={4}
                value={pendingText}
                onChange={(e) => setPendingText(e.target.value)}
                placeholder="Ej: Tengo 30 bultos de cebolla para el viernes en Aquitania"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
                  disabled={busy}
                  onClick={createPendingFromIA}
                >
                  {busy ? '...' : 'Crear'}
                </button>
              </div>
            </div>
          ) : null}

          {action === 'createRequest' ? (
            <div className="mt-3 rounded-2xl border border-zinc-200/70 bg-white/70 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40">
              <div className="text-sm font-semibold">Nueva solicitud</div>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                placeholder="Título"
              />
              <textarea
                className="mt-2 w-full resize-none rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                rows={4}
                value={reqDetails}
                onChange={(e) => setReqDetails(e.target.value)}
                placeholder="Detalles (opcional)"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
                  disabled={busy}
                  onClick={createRequestFromIA}
                >
                  {busy ? '...' : 'Crear'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded-xl border border-zinc-200/70 bg-white/70 p-3 text-xs text-zinc-600 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-300">
            Próximo: acciones por intención (“muéstrame pendientes”, “carga un producto”, “crea una alerta”) con permisos server-side.
          </div>
        </section>
      </div>
    </main>
  )
}
