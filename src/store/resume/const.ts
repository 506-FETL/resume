import type {
  ApplicationInfoFormType,
  BasicFormType,
  CampusExperienceFormType,
  EduBackgroundFormType,
  HobbiesFormType,
  HonorsCertificatesFormType,
  InternshipExperienceFormType,
  JobIntentFormType,
  ORDERType,
  PersistedResumeSnapshot,
  ProjectExperienceFormType,
  ResumeAppearanceConfig,
  ResumeTemplateBinding,
  ResumeType,
  SelfEvaluationFormType,
  SkillSpecialtyFormType,
  VisibilityItemsType,
  WorkExperienceFormType,
} from '@/lib/schema'
import {
  DEFAULT_APPLICATION_INFO,
  DEFAULT_BASICS,
  DEFAULT_CAMPUS_EXPERIENCE,
  DEFAULT_EDU_BACKGROUND,
  DEFAULT_HOBBIES,
  DEFAULT_HONORS_CERTIFICATES,
  DEFAULT_INTERNSHIP_EXPERIENCE,
  DEFAULT_JOB_INTENT,
  DEFAULT_PROJECT_EXPERIENCE,
  DEFAULT_SELF_EVALUATION,
  DEFAULT_SKILL_SPECIALTY,
  DEFAULT_WORK_EXPERIENCE,
} from '@/lib/schema'

export interface FormDataMap {
  basics: BasicFormType
  job_intent: JobIntentFormType
  application_info: ApplicationInfoFormType
  edu_background: EduBackgroundFormType
  work_experience: WorkExperienceFormType
  internship_experience: InternshipExperienceFormType
  campus_experience: CampusExperienceFormType
  project_experience: ProjectExperienceFormType
  skill_specialty: SkillSpecialtyFormType
  honors_certificates: HonorsCertificatesFormType
  self_evaluation: SelfEvaluationFormType
  hobbies: HobbiesFormType
}

export type PersistableResumeState = FormDataMap & {
  order: ORDERType[]
  visibility: Record<VisibilityItemsType, boolean>
  type: ResumeType
  templateBinding?: ResumeTemplateBinding
}

export type ResumeFormPayload = Omit<
  PersistedResumeSnapshot,
  keyof ResumeAppearanceConfig
>

export const FORM_FIELD_DEFAULTS: {
  [K in keyof FormDataMap]: { default: FormDataMap[K]; legacyKey?: string }
} = {
  basics: { default: DEFAULT_BASICS },
  job_intent: { default: DEFAULT_JOB_INTENT, legacyKey: 'jobIntent' },
  application_info: {
    default: DEFAULT_APPLICATION_INFO,
    legacyKey: 'applicationInfo',
  },
  edu_background: {
    default: DEFAULT_EDU_BACKGROUND,
    legacyKey: 'eduBackground',
  },
  work_experience: {
    default: DEFAULT_WORK_EXPERIENCE,
    legacyKey: 'workExperience',
  },
  internship_experience: {
    default: DEFAULT_INTERNSHIP_EXPERIENCE,
    legacyKey: 'internshipExperience',
  },
  campus_experience: {
    default: DEFAULT_CAMPUS_EXPERIENCE,
    legacyKey: 'campusExperience',
  },
  project_experience: {
    default: DEFAULT_PROJECT_EXPERIENCE,
    legacyKey: 'projectExperience',
  },
  skill_specialty: {
    default: DEFAULT_SKILL_SPECIALTY,
    legacyKey: 'skillSpecialty',
  },
  honors_certificates: {
    default: DEFAULT_HONORS_CERTIFICATES,
    legacyKey: 'honorsCertificates',
  },
  self_evaluation: {
    default: DEFAULT_SELF_EVALUATION,
    legacyKey: 'selfEvaluation',
  },
  hobbies: { default: DEFAULT_HOBBIES },
}

export const FORM_DATA_KEYS = Object.keys(
  FORM_FIELD_DEFAULTS,
) as (keyof FormDataMap)[]

export const SYNC_DELAY = 3000

export const ONLINE_SYNC_DELAY = 3000

export const LEGACY_RESUME_CONFIG_STORAGE_KEY = 'resume-config-storage'

export const PX_TO_MM = 25.4 / 96
