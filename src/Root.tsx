import { useEffect, useState } from 'react'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'

import App from './App'
import { configureAmplifyFromPublicOutputs } from './amplify/bootstrap'

export default function Root() {
  const [amplifyReady, setAmplifyReady] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    ;(async () => {
      const result = await configureAmplifyFromPublicOutputs()
      setAmplifyReady(result.ok)
      setBootstrapError(result.error)
      setChecked(true)
    })()
  }, [])

  if (!checked) {
    return (
      <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-xl px-4 py-10">
          <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
            <div className="text-base font-semibold">Cargando…</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Inicializando PWA y configuración.</div>
          </div>
        </div>
      </div>
    )
  }

  // Backend obligatorio: si no hay outputs, no iniciamos la app.
  if (!amplifyReady) {
    return (
      <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-xl px-4 py-10">
          <div className="rounded-2xl border border-rose-200/70 bg-white/70 p-4 shadow-sm dark:border-rose-900/50 dark:bg-zinc-950/40">
            <div className="text-base font-semibold">Backend no configurado</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Esta instalación requiere backend de Amplify. Verifica el archivo public/amplify_outputs.json.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-xl px-4 pt-4 md:max-w-3xl">
        <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-3 text-sm shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
          <div className="font-semibold">Estado de conexión</div>
          <div className="mt-1 text-zinc-600 dark:text-zinc-300">
            Amplify configurado correctamente. La conexión a base de datos se valida al iniciar sesión.
          </div>
          {bootstrapError ? (
            <div className="mt-2 text-xs text-rose-700 dark:text-rose-300">Detalle técnico: {bootstrapError}</div>
          ) : null}
        </div>
      </div>

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
    </div>
  )
}
