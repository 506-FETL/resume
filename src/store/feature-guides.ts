import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type FeatureGuideId = 'comments' | 'assistant-quote' | 'sorting'

interface FeatureGuidesState {
  dismissed: Record<string, FeatureGuideId[]>
  active: { id: FeatureGuideId; session: string; step: number } | null
  claim: (id: FeatureGuideId, session: string) => boolean
  setStep: (session: string, step: number) => void
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

        set({ active: { id, session, step: 0 } })

        return true
      },
      setStep: (session, step) => {
        const { active } = get()

        if (active?.session === session) set({ active: { ...active, step } })
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
      version: 1,
      migrate: () => ({ dismissed: {} }),
      storage: createJSONStorage(() => localStorage),
      partialize: ({ dismissed }) => ({ dismissed }),
    },
  ),
)
