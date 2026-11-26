import type { ResumeType } from '@/lib/schema'
import { create } from 'zustand'

export interface JobContext {
  id: string
  userId: string
  company: string
  position: string
  jdText?: string
  resumeId: string | null
  resumeType: ResumeType | null
  resumeName: string | null
}

export const useJobContextStore = create<{
  context: JobContext | null
  setContext: (context: JobContext | null) => void
}>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
}))
