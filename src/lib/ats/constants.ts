import type { ScoreKey } from '../schema/ats.ts'

export const ATS_SCORE_MAX = {
  job_match: 25,
  content_completeness: 25,
  impact_quantification: 20,
  ats_parsing: 15,
  format_readability: 15,
} satisfies Record<ScoreKey, number>

export const ATS_SCORE_TOTAL = Object.values(ATS_SCORE_MAX)
  .reduce((sum, value) => sum + value, 0)

export const ATS_SECTION_LABELS = {
  basics: '基本信息',
  job_intent: '求职意向',
  edu_background: '教育背景',
  work_experience: '工作经历',
  internship_experience: '实习经历',
  campus_experience: '校园经历',
  project_experience: '项目经历',
  skill_specialty: '技能特长',
  honors_certificates: '荣誉证书',
  self_evaluation: '自我评价',
  hobbies: '兴趣爱好',
} as const

export const ATS_FIELD_LABELS: Record<string, string> = {
  name: '姓名',
  phone: '手机号',
  email: '邮箱',
  workYears: '工作年限',
  customFields: '自定义信息',
  jobIntent: '意向岗位',
  intentionalCity: '意向城市',
  expectedSalary: '期望薪资',
  dateEntry: '到岗时间',
  schoolName: '学校',
  professional: '专业',
  degree: '学历',
  duration: '时间',
  eduInfo: '教育描述',
  companyName: '公司',
  position: '岗位',
  workDuration: '时间',
  workInfo: '工作描述',
  internshipDuration: '时间',
  internshipInfo: '实习描述',
  experienceName: '经历名称',
  role: '角色',
  campusInfo: '经历描述',
  projectName: '项目名称',
  participantRole: '角色',
  projectDuration: '时间',
  projectInfo: '项目描述',
  description: '说明',
  label: '技能',
  proficiencyLevel: '熟练度',
  certificates: '证书',
  content: '内容',
  hobbies: '兴趣爱好',
}
