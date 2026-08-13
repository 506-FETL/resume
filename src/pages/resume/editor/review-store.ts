import { create } from 'zustand'

interface ResumeReviewState {
  active: boolean
  setActive: (active: boolean) => void
}

export const useResumeReviewStore = create<ResumeReviewState>(set => ({
  active: false,
  setActive: active => set({ active }),
}))
