import { useEffect, useState } from 'react'

type ChatMessage = {
  id: string
  petitionId: string
  author: string
  text: string
  createdAt: string
}

const STORAGE_KEY = 'agrotrocha.chat.v1'

function loadAllMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ChatMessage[]
  } catch {
    return []
  }
}

function saveAllMessages(list: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function ChatModule({ petitionId, username, onClose }: { petitionId: string; username: string | null | undefined; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadAllMessages().filter((m) => m.petitionId === petitionId))
  const [text, setText] = useState('')

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return
      const all = loadAllMessages()
      setMessages(all.filter((m) => m.petitionId === petitionId))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [petitionId])

  function send() {
    if (!text.trim()) return
    const author = username ?? 'Anónimo'
    const msg: ChatMessage = { id: crypto.randomUUID(), petitionId, author, text: text.trim(), createdAt: new Date().toISOString() }
    const all = loadAllMessages()
    const next = [...all, msg]
    saveAllMessages(next)
    setMessages(next.filter((m) => m.petitionId === petitionId))
    setText('')
    // trigger storage event for same-tab listeners
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
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
              <div className="text-xs text-zinc-500">{m.author} · {new Date(m.createdAt).toLocaleString()}</div>
              <div className="mt-1 rounded-md bg-white/90 px-3 py-2 text-sm">{m.text}</div>
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
