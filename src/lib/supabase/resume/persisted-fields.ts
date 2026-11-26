const RENDER_FIELDS = [
  'basics',
  'job_intent',
  'application_info',
  'edu_background',
  'work_experience',
  'internship_experience',
  'campus_experience',
  'project_experience',
  'skill_specialty',
  'honors_certificates',
  'self_evaluation',
  'hobbies',
  'order',
  'visibility',
  'type',
  'template_binding',
  'spacing',
  'font',
  'theme',
] as const

export const RESUME_RENDER_SELECTOR = RENDER_FIELDS.join(',')

export const RESUME_PERSISTED_FIELDS = [
  ...RENDER_FIELDS,
  'parent_resume_id',
  'linked_jd_text',
  'derived_metadata',
  'derived_status',
] as const

export const RESUME_PERSISTED_SELECTOR = RESUME_PERSISTED_FIELDS.join(',')
