import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface ChangelogState {
  seenEntries: Record<string, string>
  markAsRead: (account: string, entry: string) => void
}

export const useChangelogStore = create<ChangelogState>()(
  persist(
    (set, get) => ({
      seenEntries: {},
      markAsRead: (account, entry) => {
        if ((get().seenEntries[account] ?? '') >= entry) return

        set((state) => ({
          seenEntries: { ...state.seenEntries, [account]: entry },
        }))
      },
    }),
    {
      name: 'gresume-changelog-read',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ seenEntries }) => ({ seenEntries }),
    },
  ),
)
