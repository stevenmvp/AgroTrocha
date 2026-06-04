import { type FC } from 'react'

type AppProps = {
  amplifyReady: boolean
  auth?: {
    username: string | null
    signOut: (() => void) | null
  }
}

const App: FC<AppProps> = () => {
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <main className="mx-auto max-w-6xl px-4 py-6 w-full">AgroTrocha</main>
    </div>
  )
}

export default App
