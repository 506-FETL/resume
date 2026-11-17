import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type FeatureGuideId = 'comments' | 'assistant-quote' | 'sorting'

interface FeatureGuidesState {
  dismissed: Record<string, FeatureGuideId[]>
  active: { id: FeatureGuideId; session: string } | null
  claim: (id: FeatureGuideId, session: string) => boolean
  release: (session: string) => void
  dismiss: (account: string, id: FeatureGuideId) => void
}

export const useFeatureGuidesStore = create<FeatureGuidesState>()(
  persist(
    (set, get) => ({
      dismissed: {},
      active: null,
      claim: (id, session) => {
        if (get().active && get().active?.session !== session) return false

        set({ active: { id, session } })

        return true
      },
      release: (session) => {
        if (get().active?.session === session) set({ active: null })
      },
      dismiss: (account, id) => {
        const previous = get().dismissed[account] ?? []

        if (previous.includes(id)) return

        set((state) => ({
          dismissed: { ...state.dismissed, [account]: [...previous, id] },
        }))
      },
    }),
    {
      name: 'gresume-feature-guides-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ dismissed }) => ({ dismissed }),
    },
  ),
)
