import { useEffect, useState } from 'react'
import { generateClient } from 'aws-amplify/api'
import type { Schema } from '../../amplify/data/resource'

export type Profile = {
  name: string
  phone: string
  municipio: string
  vereda: string
  role: 'PRODUCTOR' | 'TRANSPORTISTA'
}

const STORAGE_KEY = 'agrotrocha.profile.v1'

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { name: '', phone: '', municipio: '', vereda: '', role: 'PRODUCTOR' }
    const parsed = JSON.parse(raw) as Partial<Profile>
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

export function saveProfile(profile: Profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

type PerfilModuleProps = {
  username: string | null
  amplifyReady: boolean
  isOnline: boolean
  onToast: (toast: { kind: 'success' | 'error' | 'info'; message: string }) => void
}

export function PerfilModule({ username, amplifyReady, isOnline, onToast }: PerfilModuleProps) {
  const [profile, setProfile] = useState<Profile>(() => loadProfile())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    saveProfile(profile)
  }, [profile])

  const canSync = amplifyReady && isOnline && Boolean(username)

  function updateField<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    if (!profile.name.trim()) {
      onToast({ kind: 'error', message: 'El nombre es obligatorio.' })
      return false
    }
    if (!profile.municipio.trim()) {
      onToast({ kind: 'error', message: 'El municipio es obligatorio.' })
      return false
    }
    return true
  }

  async function syncProfile() {
    if (!validate()) return
    if (!canSync) {
      onToast({ kind: 'info', message: 'Debes estar online y autenticado para sincronizar.' })
      return
    }

    setBusy(true)
    try {
      const client = generateClient<Schema>()
      const userId = username ?? ''
      const existing = await client.models.User.get({ id: userId })
      const payload = {
        id: userId,
        name: profile.name,
        phone: profile.phone,
        municipio: profile.municipio,
        vereda: profile.vereda,
        role: profile.role,
        countryCode: 'CO',
      }

      if (existing?.data) {
        await client.models.User.update(payload)
      } else {
        await client.models.User.create(payload)
      }

      onToast({ kind: 'success', message: 'Perfil sincronizado con el backend.' })
    } catch (error) {
      console.error('Perfil sync error:', error)
      onToast({ kind: 'error', message: 'No se pudo sincronizar el perfil.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200/70 bg-white/70 p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
        <div className="flex flex-col gap-2">
          <div className="text-xl font-semibold">Perfil</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Guarda tu perfil localmente. Si estás online y el backend está listo, puedes sincronizarlo a Amplify.
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold">Nombre</div>
            <input
              value={profile.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Tu nombre"
              className="mt-2 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold">Teléfono</div>
            <input
              value={profile.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+57..."
              className="mt-2 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold">Municipio</div>
            <input
              value={profile.municipio}
              onChange={(e) => updateField('municipio', e.target.value)}
              placeholder="Aquitania"
              className="mt-2 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold">Vereda</div>
            <input
              value={profile.vereda}
              onChange={(e) => updateField('vereda', e.target.value)}
              placeholder="Opcional"
              className="mt-2 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            />
          </label>

          <label className="block sm:col-span-2">
            <div className="text-sm font-semibold">Rol</div>
            <select
              value={profile.role}
              onChange={(e) => updateField('role', e.target.value as Profile['role'])}
              className="mt-2 w-full rounded-2xl border border-zinc-200/70 bg-white/70 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200 dark:border-zinc-800/60 dark:bg-zinc-950/40"
            >
              <option value="PRODUCTOR">Productor</option>
              <option value="TRANSPORTISTA">Transportista</option>
            </select>
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950"
            onClick={() => {
              saveProfile(profile)
              onToast({ kind: 'success', message: 'Perfil guardado localmente.' })
            }}
          >
            Guardar local
          </button>

          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            {canSync
              ? 'Puedes sincronizar el perfil con el backend.'
              : 'Para sincronizar necesitas estar online y autenticado.'}
          </div>

          <button
            type="button"
            className="rounded-2xl border border-zinc-200/70 bg-white/70 px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:text-zinc-200"
            onClick={syncProfile}
            disabled={!canSync || busy}
          >
            {busy ? 'Sincronizando…' : 'Sincronizar backend'}
          </button>
        </div>
      </section>
    </div>
  )
}
