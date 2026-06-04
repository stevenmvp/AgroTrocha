import { useEffect, useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { Schema } from '../../amplify/data/resource'
import { loadProfile } from './Perfil'

type ChatMessage = {
  id: string
  petitionId: string
  authorId?: string | null
  authorName: string
  authorRole?: 'PRODUCTOR' | 'TRANSPORTISTA' | 'ADMIN' | 'OPERADOR'
  content: string
  createdAt: string
}

export function ChatModule({ petitionId, username, onClose }: { petitionId: string; username: string | null | undefined; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const profile = loadProfile()

  useEffect(() => {
    const client: any = generateClient<Schema>()
    let stopped = false
    let cleanup: any

    // Prefer observeQuery if available (real-time); otherwise fallback to polling list
    try {
      const chatModel = client.models?.ChatMessage
      if (chatModel && typeof chatModel.observeQuery === 'function') {
        const obs = chatModel.observeQuery({ filter: { petitionId: { eq: petitionId } }, sort: { createdAt: 'asc' } })
        const sub = obs.subscribe({
          next: (res: any) => {
            if (stopped) return
            setMessages(res.items ?? res)
          },
          error: (err: any) => console.error('chat observe error', err),
        })
        cleanup = () => sub.unsubscribe()
      } else if (chatModel && typeof chatModel.list === 'function') {
        let timer: any
        async function fetchOnce() {
          try {
            const res = await chatModel.list({ petitionId })
            if (stopped) return
            setMessages(res?.items ?? res ?? [])
          } catch (err) {
            console.error('chat list error', err)
          }
        }
        fetchOnce()
        timer = setInterval(fetchOnce, 2000)
        cleanup = () => clearInterval(timer)
      } else {
        // no model available yet; no-op
      }
    } catch (err) {
      console.error('chat init error', err)
    }

    return () => {
      stopped = true
      if (cleanup) cleanup()
    }
  }, [petitionId])

  async function send() {
    if (!text.trim()) return
    const client: any = generateClient<Schema>()
    try {
      const payload = {
        petitionId,
        authorId: undefined,
        authorName: username ?? profile.name ?? 'Anónimo',
        authorRole: profile.role,
        content: text.trim(),
        createdAt: new Date().toISOString(),
      }
      if (client.models?.ChatMessage && typeof client.models.ChatMessage.create === 'function') {
        await client.models.ChatMessage.create(payload)
        setText('')
      } else {
        // fallback: optimistic local append until backend available
        const msg: ChatMessage = { id: crypto.randomUUID(), petitionId, authorName: payload.authorName, authorRole: payload.authorRole, content: payload.content, createdAt: payload.createdAt }
        setMessages((prev) => [...prev, msg])
        setText('')
      }
    } catch (err) {
      console.error('chat send error', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Chat de petición {petitionId}</div>
          <button onClick={onClose} className="text-sm text-zinc-500">Cerrar</button>
        </div>

        <div className="mt-4 h-64 overflow-auto rounded-md border p-3 bg-zinc-50">
          {messages.map((m) => (
            <div key={m.id} className="mb-2">
              <div className="text-xs text-zinc-500">{m.authorName} · {new Date(m.createdAt).toLocaleString()}</div>
              <div className="mt-1 rounded-md bg-white/90 px-3 py-2 text-sm">{m.content}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje..." className="flex-1 rounded-2xl border px-3 py-2" />
          <button onClick={send} className="rounded-2xl bg-emerald-600 px-4 py-2 text-white">Enviar</button>
        </div>
      </div>
    </div>
  )
}
