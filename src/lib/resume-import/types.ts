import type { ResumeSchema } from '../schema/resume'
import type { EntrySection } from '../../../supabase/functions/shared/resume-import-contract'

export interface ImportEntrySource {
  section: EntrySection
  start: number
  end: number
  headerLine: number
  bodyLines: number[]
  continuationLines: number[]
}

export interface ResumeParseResult {
  content: ResumeSchema
  unassignedText: string
  warnings: string[]
  sources?: { entries: Record<string, ImportEntrySource> }
}

export interface ExtractedResumeFile {
  text: string
  sourceName: string
}

export type ResumeImportErrorCode =
  | 'unsupported'
  | 'too-large'
  | 'too-many-pages'
  | 'too-much-text'
  | 'encrypted'
  | 'corrupt'
  | 'scanned'
  | 'empty'

export class ResumeImportError extends Error {
  readonly code: ResumeImportErrorCode

  constructor(code: ResumeImportErrorCode, message: string) {
    super(message)
    this.name = 'ResumeImportError'
    this.code = code
  }
}
