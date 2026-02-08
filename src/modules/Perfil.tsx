import { useEffect, useMemo, useState } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'

type ProfileDraft = {
  name: string
  phone: string
  municipio: string
  vereda: string
  role: 'PRODUCTOR' | 'TRANSPORTISTA'
}

const KEY = 'agrotrocha.profileDraft.v1'

function loadDraft(): ProfileDraft {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { name: '', phone: '', municipio: '', vereda: '', role: 'PRODUCTOR' }
    const parsed = JSON.parse(raw) as Partial<ProfileDraft>
    return {
      name: String(parsed.name ?? ''),
      phone: String(parsed.phone ?? ''),
      municipio: String(parsed.municipio ?? ''),
      vereda: String(parsed.vereda ?? ''),
      role: parsed.role === 'TRANSPORTISTA' ? 'TRANSPORTISTA' : 'PRODUCTOR',
    }
  } catch {
    return { name: '', phone: '', municipio: '', vereda: '', role: 'PRODUCTOR' }
  }
}

function saveDraft(d: ProfileDraft) {
  localStorage.setItem(KEY, JSON.stringify(d))
}

type RequestDraft = {
  id: string
  createdAt: string
  type: 'SUPPORT' | 'ROLE_CHANGE' | 'DATA_FIX' | 'OTHER'
  title: string
  details: string
  status: 'OPEN' | 'DONE'
  backendId?: string
}

const REQUESTS_KEY = 'agrotrocha.requests.v1'

function loadRequestsLocal(): RequestDraft[] {
  try {
    const raw = localStorage.getItem(REQUESTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RequestDraft[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveRequestsLocal(next: RequestDraft[]) {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(next))
}

function makeId() {
  return crypto.randomUUID()
}

export function PerfilModule({
  username,
  amplifyReady,
  onToast,
}: {
  username: string | null
  amplifyReady: boolean
  onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void
}) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-4 md:max-w-3xl">
      <PerfilContent username={username} amplifyReady={amplifyReady} onToast={onToast} />
    </main>
  )
}

export function PerfilContent({
  username,
  amplifyReady,
  onToast,
}: {
  username: string | null
  amplifyReady: boolean
  onToast: (t: { kind: 'success' | 'error' | 'info'; message: string }) => void
}) {
  const [draft, setDraft] = useState<ProfileDraft>(() => loadDraft())
  const [requests, setRequests] = useState<RequestDraft[]>(() => loadRequestsLocal())
  const [reqType, setReqType] = useState<RequestDraft['type']>('SUPPORT')
  const [reqTitle, setReqTitle] = useState('')
  const [reqDetails, setReqDetails] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    saveRequestsLocal(requests)
  }, [requests])

  const header = useMemo(() => {
    if (!amplifyReady) return 'Modo local: el perfil se guarda en este dispositivo.'
    return 'Backend listo: en el siguiente paso sincronizamos este perfil a Amplify Data.'
  }, [amplifyReady])

  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value }
      saveDraft(next)
      return next
    })
  }

  function validateProfile() {
    if (!draft.name.trim()) {
      onToast({ kind: 'error', message: 'Nombre es requerido.' })
      return false
    }
    if (!draft.municipio.trim()) {
      onToast({ kind: 'error', message: 'Municipio es requerido.' })
      return false
    }
    return true
  }

  async function onSaveProfileLocal() {
    if (!validateProfile()) return
    onToast({ kind: 'success', message: 'Perfil guardado (local).' })
  }

  async function onSyncProfileBackend() {
    if (!validateProfile()) return
    if (!amplifyReady) {
      onToast({ kind: 'info', message: 'Backend no está listo.' })
      return
    }

    setBusy(true)
    try {
      const current = await getCurrentUser()
      const client = generateClient<Schema>()

      // Usamos el sub como id para que sea fácil de recuperar.
      const id = current.userId

      // Intento upsert (get -> update, si no existe -> create)
      try {
        const existing = await client.models.User.get({ id })
        if (existing.data) {
          await client.models.User.update({
            id,
            name: draft.name,
            role: draft.role,
            countryCode: 'CO',
            municipio: draft.municipio,
            vereda: draft.vereda,
            phone: draft.phone,
          })
        } else {
          await client.models.User.create({
            id,
            name: draft.name,
            role: draft.role,
            countryCode: 'CO',
            municipio: draft.municipio,
            vereda: draft.vereda,
            phone: draft.phone,
          })
        }
      } catch {
        await client.models.User.create({
          id,
          name: draft.name,
          role: draft.role,
          countryCode: 'CO',
          municipio: draft.municipio,
          vereda: draft.vereda,
          phone: draft.phone,
        })
      }

      onToast({ kind: 'success', message: 'Perfil sincronizado al backend.' })

      // Public profile (mínimo) para trazabilidad.
      try {
        await client.models.UserPublic.create({
          id,
          displayName: draft.name,
          role: draft.role,
          municipio: draft.municipio,
          vereda: draft.vereda,
          phone: draft.phone,
          updatedAt: new Date().toISOString(),
        })
      } catch {
        try {
          await client.models.UserPublic.update({
            id,
            displayName: draft.name,
            role: draft.role,
            municipio: draft.municipio,
            vereda: draft.vereda,
            phone: draft.phone,
            updatedAt: new Date().toISOString(),
          })
        } catch {
          // ignore
        }
      }
    } catch {
      onToast({ kind: 'error', message: 'No pude sincronizar el perfil.' })
    } finally {
      setBusy(false)
    }
  }

  async function onCreateRequest() {
    const title = reqTitle.trim()
    const details = reqDetails.trim()
    if (!title) {
      onToast({ kind: 'error', message: 'Título es requerido.' })
      return
    }

    const local: RequestDraft = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      type: reqType,
      title,
      details,
      status: 'OPEN',
    }

    // Guardamos local siempre (offline-first)
    setRequests((prev) => [local, ...prev])
    setReqTitle('')
    setReqDetails('')

    if (!amplifyReady || !navigator.onLine) {
      onToast({ kind: 'success', message: 'Solicitud guardada (local).' })
      return
    }

    setBusy(true)
    try {
      const current = await getCurrentUser()
      const client = generateClient<Schema>()
      const created = await client.models.Request.create({
        createdByUserId: current.userId,
        type: reqType,
        status: 'OPEN',
        title,
        details,
      })

      if (created.data?.id) {
        setRequests((prev) =>
          prev.map((r) => (r.id === local.id ? { ...r, backendId: created.data!.id } : r))
        )
      }
      onToast({ kind: 'success', message: 'Solicitud creada en el backend.' })
    } catch {
      onToast({ kind: 'info', message: 'No pude sincronizar solicitud; queda local.' })
    } finally {
      setBusy(false)
    }
  }

  function deleteRequestLocal(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id))
    onToast({ kind: 'success', message: 'Solicitud eliminada (local).' })
  }

  return (
    <>
      <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
        <h2 className="text-base font-semibold">Mi perfil</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{header}</p>

        <div className="mt-3 grid gap-3">
          <div>
            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Usuario</div>
            <div className="text-sm">{username ?? '—'}</div>
          </div>

          <label className="block">
            <div className="text-sm font-semibold">Nombre</div>
            <input
              className="mt-1 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Tu nombre"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Rol</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-300">En fase 2 vendrá de Cognito/claims.</div>
            </div>
            <select
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              value={draft.role}
              onChange={(e) => update('role', e.target.value as ProfileDraft['role'])}
            >
              <option value="PRODUCTOR">Productor</option>
              <option value="TRANSPORTISTA">Transportista</option>
            </select>
          </div>

          <label className="block">
            <div className="text-sm font-semibold">Teléfono</div>
            <input
              className="mt-1 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              value={draft.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+57..."
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm font-semibold">Municipio</div>
              <input
                className="mt-1 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={draft.municipio}
                onChange={(e) => update('municipio', e.target.value)}
                placeholder="Aquitania"
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold">Vereda</div>
              <input
                className="mt-1 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                value={draft.vereda}
                onChange={(e) => update('vereda', e.target.value)}
                placeholder="(opcional)"
              />
            </label>
          </div>

          <button
            type="button"
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white dark:bg-emerald-500 dark:text-zinc-950"
            onClick={onSaveProfileLocal}
          >
            Guardar
          </button>

          {amplifyReady ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                Sincroniza este perfil a la tabla <span className="font-semibold">User</span>.
              </div>
              <button
                type="button"
                className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold disabled:opacity-60 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                disabled={busy}
                onClick={onSyncProfileBackend}
              >
                {busy ? '...' : 'Sincronizar'}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
        <h2 className="text-base font-semibold">Solicitudes</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Crea solicitudes de soporte / cambios. Offline-first.</p>

        <div className="mt-3 grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Tipo</div>
            <select
              className="rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              value={reqType}
              onChange={(e) => setReqType(e.target.value as RequestDraft['type'])}
            >
              <option value="SUPPORT">Soporte</option>
              <option value="ROLE_CHANGE">Cambio de rol</option>
              <option value="DATA_FIX">Corrección de datos</option>
              <option value="OTHER">Otra</option>
            </select>
          </div>

          <label className="block">
            <div className="text-sm font-semibold">Título</div>
            <input
              className="mt-1 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              value={reqTitle}
              onChange={(e) => setReqTitle(e.target.value)}
              placeholder="Ej: No puedo editar un pendiente"
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold">Detalles</div>
            <textarea
              className="mt-1 w-full resize-none rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
              rows={3}
              value={reqDetails}
              onChange={(e) => setReqDetails(e.target.value)}
              placeholder="Describe el problema o la solicitud"
            />
          </label>

          <button
            type="button"
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-emerald-500 dark:text-zinc-950"
            disabled={busy}
            onClick={onCreateRequest}
          >
            {busy ? '...' : 'Crear solicitud'}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {requests.slice(0, 10).map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-zinc-200/70 bg-white/60 p-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{r.title}</div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {r.type} · {r.status} {r.backendId ? '· backend' : '· local'}
                  </div>
                  {r.details ? <div className="mt-2 text-zinc-700 dark:text-zinc-200">{r.details}</div> : null}
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                  onClick={() => deleteRequestLocal(r.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {requests.length === 0 ? <div className="text-sm text-zinc-600 dark:text-zinc-300">Aún no hay solicitudes.</div> : null}
        </div>
      </section>
    </>
  )
}
