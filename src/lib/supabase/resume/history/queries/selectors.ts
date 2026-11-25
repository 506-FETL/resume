export const VERSION_SELECTOR = `
  id,
  created_at,
  updated_at,
  user_id,
  resume_id,
  version_no,
  version_name,
  description,
  milestone_name,
  source_type,
  tags,
  snapshot,
  content_hash,
  base_updated_at,
  company_id,
  submitted_at,
  status,
  document_revision,
  projection_reference_date
`

// 列表用：不含 snapshot（侧边栏渲染用不到），大幅减小载荷
export const VERSION_LIST_SELECTOR = `
  id,
  created_at,
  updated_at,
  user_id,
  resume_id,
  version_no,
  version_name,
  description,
  milestone_name,
  source_type,
  tags,
  content_hash,
  base_updated_at,
  company_id,
  submitted_at,
  status,
  document_revision,
  projection_reference_date
`

export const RESUME_SELECTOR = `
  resume_id,
  updated_at,
  display_name,
  description,
  type,
  basics,
  job_intent,
  application_info,
  edu_background,
  work_experience,
  internship_experience,
  campus_experience,
  project_experience,
  skill_specialty,
  honors_certificates,
  self_evaluation,
  hobbies,
  order,
  visibility,
  spacing,
  font,
  theme,
  template_binding
`

export const RESUME_OPTION_SELECTOR = `
  resume_id,
  updated_at,
  display_name,
  description,
  type
`

export const VERSION_SUMMARY_SELECTOR = `
  id,
  resume_id,
  version_no,
  created_at,
  source_type,
  milestone_name
`

export const VERSION_SHARE_RELEASE_SELECTOR = `
  resume_id,
  version_no,
  version_name,
  milestone_name,
  created_at,
  snapshot,
  status,
  document_revision,
  projection_reference_date
`
