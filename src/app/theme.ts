import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  apply: () => void
}

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      setMode: (mode) => {
        set({ mode })
        get().apply()
      },
      apply: () => {
        const { mode } = get()
        const dark = mode === 'dark' || (mode === 'system' && systemPrefersDark())
        document.documentElement.classList.toggle('dark', dark)
      },
    }),
    { name: 'pdf-tweaks-theme' },
  ),
)
