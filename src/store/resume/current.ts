import type { ResumeType } from '@/lib/schema'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface CurrentResumeState {
  resumeId: string | null
  resumeType: ResumeType | null
  setCurrentResume: (id: string, type: ResumeType) => void
  clearCurrentResume: () => void
}

/**
 * 当前编辑简历的 Store
 */
const useCurrentResumeStore = create<CurrentResumeState>()(
  persist(
    (set) => ({
      resumeId: null,
      resumeType: null,
      setCurrentResume: (id, type) => set({ resumeId: id, resumeType: type }),
      clearCurrentResume: () => set({ resumeId: null, resumeType: null }),
    }),
    {
      name: 'current-resume-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)

export default useCurrentResumeStore
