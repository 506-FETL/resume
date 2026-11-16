import type { ResumePreviewData } from '../components/drawer/types'
import type { TemplateResumeDataInput } from '@/components/resume/runtime/context/resume-data-context'
import {
  DEFAULT_APPLICATION_INFO,
  DEFAULT_BASICS,
  DEFAULT_CAMPUS_EXPERIENCE,
  DEFAULT_EDU_BACKGROUND,
  DEFAULT_HOBBIES,
  DEFAULT_HONORS_CERTIFICATES,
  DEFAULT_INTERNSHIP_EXPERIENCE,
  DEFAULT_JOB_INTENT,
  DEFAULT_ORDER,
  DEFAULT_PROJECT_EXPERIENCE,
  DEFAULT_SELF_EVALUATION,
  DEFAULT_SKILL_SPECIALTY,
  DEFAULT_VISIBILITY,
  DEFAULT_WORK_EXPERIENCE,
  migrateOrder,
  migrateVisibility,
  normalizeResumeType,
  resolveResumeTemplateBinding,
} from '@/lib/schema'

// 将 Supabase snake_case 字段转换为 camelCase
export function mapSnakeToCamel(data: any): any {
  if (!data) return null

  return {
    type: data.type,
    basics: data.basics,
    jobIntent: data.jobIntent || data.job_intent,
    eduBackground: data.eduBackground || data.edu_background,
    workExperience: data.workExperience || data.work_experience,
    internshipExperience:
      data.internshipExperience || data.internship_experience,
    campusExperience: data.campusExperience || data.campus_experience,
    projectExperience: data.projectExperience || data.project_experience,
    skillSpecialty: data.skillSpecialty || data.skill_specialty,
    honorsCertificates: data.honorsCertificates || data.honors_certificates,
    selfEvaluation: data.selfEvaluation || data.self_evaluation,
    hobbies: data.hobbies,
    applicationInfo: data.applicationInfo || data.application_info,
    order: data.order,
    visibility: data.visibility,
  }
}

// 兼容旧调用点；完整职位转换应直接使用 transitionJobWorkflow。
export function normalizeResumePreviewData(
  data: ResumePreviewData,
): TemplateResumeDataInput {
  const type = normalizeResumeType(data.type)

  return {
    basics: data.basics ?? DEFAULT_BASICS,
    job_intent: data.job_intent ?? DEFAULT_JOB_INTENT,
    application_info: data.application_info ?? DEFAULT_APPLICATION_INFO,
    edu_background: data.edu_background ?? DEFAULT_EDU_BACKGROUND,
    work_experience: data.work_experience ?? DEFAULT_WORK_EXPERIENCE,
    internship_experience:
      data.internship_experience ?? DEFAULT_INTERNSHIP_EXPERIENCE,
    campus_experience: data.campus_experience ?? DEFAULT_CAMPUS_EXPERIENCE,
    project_experience: data.project_experience ?? DEFAULT_PROJECT_EXPERIENCE,
    skill_specialty: data.skill_specialty ?? DEFAULT_SKILL_SPECIALTY,
    honors_certificates:
      data.honors_certificates ?? DEFAULT_HONORS_CERTIFICATES,
    self_evaluation: data.self_evaluation ?? DEFAULT_SELF_EVALUATION,
    hobbies: data.hobbies ?? DEFAULT_HOBBIES,
    order: migrateOrder(data.order ?? DEFAULT_ORDER),
    visibility: migrateVisibility(data.visibility ?? DEFAULT_VISIBILITY),
    type,
    templateBinding: resolveResumeTemplateBinding(data.template_binding),
  }
}
