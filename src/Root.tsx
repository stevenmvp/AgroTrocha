import { useEffect, useState } from 'react'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'

import App from './App'
import { configureAmplifyFromPublicOutputs } from './amplify/bootstrap'

export default function Root() {
  const [amplifyReady, setAmplifyReady] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    ;(async () => {
      const ok = await configureAmplifyFromPublicOutputs()
      setAmplifyReady(ok)
      setChecked(true)
    })()
  }, [])

  if (!checked) {
    return (
      <div className="min-h-dvh bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-xl px-4 py-10">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-base font-semibold">Cargando…</div>
            <div className="mt-1 text-sm text-slate-600">Inicializando PWA y configuración.</div>
          </div>
        </div>
      </div>
    )
  }

  // Si no hay outputs, seguimos en “modo local” (offline-first) sin Auth.
  if (!amplifyReady) {
    return <App amplifyReady={false} />
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <App
          amplifyReady
          auth={{
            username: user?.username ?? null,
            signOut: signOut ?? null,
          }}
        />
      )}
    </Authenticator>
  )
}
