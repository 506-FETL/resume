import type { GenerateVariantArgs, GeneratorPhase, VariantChange } from '@/components/jd-variant/types'
import type { ResumeSchema } from '@/lib/schema'

export interface VariantTask {
  parentResumeId: string
  phase: GeneratorPhase
  draftResumeId: string | null
  keywords: string[]
  changes: VariantChange[]
  completedSections: Array<keyof ResumeSchema>
  errorMessage: string | null
  matchRate: number
  parseReasoning: string
  rewriteReasoning: string
  rewriteContent: string
}

export interface JdVariantStore {
  tasks: Record<string, VariantTask>
  startGenerate: (args: GenerateVariantArgs) => Promise<void>
  abortTask: (parentResumeId: string) => void
  discardTask: (parentResumeId: string) => Promise<void>
  clearTask: (parentResumeId: string) => void
}

export function makeIdleTask(parentResumeId: string): VariantTask {
  return {
    parentResumeId,
    phase: 'idle',
    draftResumeId: null,
    keywords: [],
    changes: [],
    completedSections: [],
    errorMessage: null,
    matchRate: 0,
    parseReasoning: '',
    rewriteReasoning: '',
    rewriteContent: '',
  }
}
