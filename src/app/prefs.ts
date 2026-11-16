import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PrefsState {
  favourites: string[]
  recent: string[]
  toggleFavourite: (slug: string) => void
  recordRecent: (slug: string) => void
}

/** Only tool slugs are stored — never file names or file contents. */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      favourites: [],
      recent: [],
      toggleFavourite: (slug) => set((s) => ({ favourites: s.favourites.includes(slug) ? s.favourites.filter((f) => f !== slug) : [...s.favourites, slug] })),
      recordRecent: (slug) => set((s) => ({ recent: [slug, ...s.recent.filter((r) => r !== slug)].slice(0, 4) })),
    }),
    { name: 'pdf-tweaks-prefs' },
  ),
)
