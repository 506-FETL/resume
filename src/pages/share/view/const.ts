import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { DEFAULT_RESUME_FONT_FAMILY_NAME } from '@/lib/schema'

export const CURRENT_REFRESH_MS = 5_000

export const HISTORY_REFRESH_MS = 30_000

export const MAX_RETRY_MS = 60_000

export const INITIAL_DOCUMENT_STATE: ResumeDocumentState = {
  status: 'measuring',
  signature: null,
  fontFamily: DEFAULT_RESUME_FONT_FAMILY_NAME,
  fontWeights: [400, 600, 700],
  error: null,
}
