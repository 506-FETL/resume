export type {
  ExperienceSourceKind,
  ExperienceSourceMetadata,
  ExperienceSourceStatus,
  ExperienceSourceBlock,
  ExperienceSourceReference,
  ExperienceSourceRelation,
  ExperienceSource,
  ExtractedExperienceFile,
  ExperienceSourceVersion,
  ExperienceSaveResult,
  ExperienceSourceReadResult,
  ExperienceSearchMatch,
  ExperienceOperation,
} from '../../../supabase/functions/shared/experience-source-contract'

export class ExperienceSourceError extends Error {
  readonly code: string
  readonly outcome: 'rejected' | 'unknown'

  constructor(
    message: string,
    code: string,
    outcome: 'rejected' | 'unknown' = 'rejected',
  ) {
    super(message)
    this.name = 'ExperienceSourceError'
    this.code = code
    this.outcome = outcome
  }
}
