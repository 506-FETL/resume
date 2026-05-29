export type RewriteAction
  = | 'star_rewrite'
    | 'quantify'
    | 'strong_verb'
    | 'polish'
    | 'align_jd'

export type RewriteSectionKey
  = | 'work_experience'
    | 'project_experience'
    | 'internship_experience'
    | 'campus_experience'
    | 'edu_background'
    | 'self_evaluation'
    | 'honors_certificates'
    | 'hobbies'
    | 'skill_specialty'

export interface RewriteFieldContext {
  sectionKey: RewriteSectionKey
  fieldLabel: string
  jobIntent?: string
}

export interface RewriteCandidate {
  id: string
  title: string
  html: string
  notes?: string
}

export interface RewriteRequestArgs {
  action: RewriteAction
  selectionText: string
  selectionHtml: string
  fieldContext: RewriteFieldContext
  jdDraft?: string
}

export type RewriteSessionStatus = 'idle' | 'waiting_jd' | 'streaming' | 'success' | 'error'

export interface RewriteSessionState {
  status: RewriteSessionStatus
  action: RewriteAction | null
  candidates: RewriteCandidate[]
  errorMessage: string | null
  jdDraft: string
}

export interface RewriteSelection {
  from: number
  to: number
  text: string
  html: string
}
