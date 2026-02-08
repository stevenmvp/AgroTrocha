export type Density = 'compact' | 'comfortable'

export type Theme = 'light' | 'dark'

export type Settings = {
  density: Density
  sttEnabled: boolean
  ttsEnabled: boolean
  theme: Theme
}

const KEY = 'agrotrocha.settings.v1'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { density: 'comfortable', sttEnabled: true, ttsEnabled: false, theme: 'light' }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
      sttEnabled: parsed.sttEnabled !== false,
      ttsEnabled: parsed.ttsEnabled === true,
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    }
  } catch {
    return { density: 'comfortable', sttEnabled: true, ttsEnabled: false, theme: 'light' }
  }
}

export function saveSettings(next: Settings) {
  localStorage.setItem(KEY, JSON.stringify(next))
}
