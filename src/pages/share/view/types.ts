import type { ShareCommentAccess } from './hooks/use-share-comment-access'
import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'

export type ViewState
  = | { phase: 'loading' }
    | { phase: 'password', wrong: boolean, rateLimited: boolean }
    | {
      sourceKind: 'current' | 'history'
      contentRevision?: string
      phase: 'ready'
      snapshot: PersistedResumeSnapshot
      templateDefinition: TemplateDefinition
      displayName: string | null
      shareId: string
      releaseId: string
      releaseNo: number | null
      versionId: number
      documentRevision: number
      allowComments: boolean
      projectionReferenceDate: string | undefined
      commentAccess: ShareCommentAccess | null
    }
    | { phase: 'unavailable' }
