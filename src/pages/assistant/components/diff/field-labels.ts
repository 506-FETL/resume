// 简历各模块字段的中文名，用于变更记录字段级对比展示

/** 模块 key → 中文名（与 src/lib/ai/tools/resume.ts 中的 SECTION_LABELS 保持一致） */
export const SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  job_intent: '求职意向',
  application_info: '应聘信息',
  edu_background: '教育背景',
  work_experience: '工作经历',
  internship_experience: '实习经历',
  campus_experience: '校园经历',
  project_experience: '项目经历',
  skill_specialty: '技能特长',
  honors_certificates: '荣誉证书',
  self_evaluation: '自我评价',
  hobbies: '兴趣爱好',
}

/**
 * 字段名 → 中文（跨模块合并；同名字段取通用语义）
 *
 * 覆盖范围：
 *   basics / jobIntent / applicationInfo / eduBackground /
 *   workExperience / internshipExperience / campusExperience /
 *   projectExperience / skillSpecialty / honorsCertificates /
 *   hobbies / selfEvaluation
 */
export const FIELD_LABELS: Record<string, string> = {
  // ── basics ──────────────────────────────────────────────────────────────
  name: '名称', // 跨模块通用（basics 姓名 / cert 证书名 / hobby 爱好名）
  gender: '性别',
  birthMonth: '出生年月',
  phone: '电话',
  email: '邮箱',
  workYears: '工作年限',
  maritalStatus: '婚姻状况',
  politicalStatus: '政治面貌',
  heightCm: '身高(cm)',
  weightKg: '体重(kg)',
  nation: '民族',
  nativePlace: '籍贯',
  customFields: '自定义字段',
  // customField 子元素
  label: '标签',
  value: '值',

  // ── jobIntent ───────────────────────────────────────────────────────────
  jobIntent: '求职意向',
  intentionalCity: '意向城市',
  expectedSalary: '期望薪资',
  dateEntry: '到岗时间',

  // ── applicationInfo ─────────────────────────────────────────────────────
  applicationSchool: '应聘学校',
  applicationMajor: '应聘专业',

  // ── eduBackground ────────────────────────────────────────────────────────
  schoolName: '学校名称',
  professional: '专业',
  degree: '学历',
  duration: '时间', // 跨模块通用（edu / campus duration）
  eduInfo: '教育描述',

  // ── workExperience ───────────────────────────────────────────────────────
  companyName: '公司名称',
  position: '职位',
  workDuration: '在职时间',
  workInfo: '工作内容',

  // ── internshipExperience ─────────────────────────────────────────────────
  internshipDuration: '实习时间',
  internshipInfo: '实习内容',

  // ── campusExperience ─────────────────────────────────────────────────────
  experienceName: '经历名称',
  role: '角色',
  campusInfo: '经历描述',

  // ── projectExperience ────────────────────────────────────────────────────
  projectName: '项目名称',
  participantRole: '担任角色',
  projectDuration: '项目时间',
  projectInfo: '项目描述',

  // ── skillSpecialty ───────────────────────────────────────────────────────
  description: '描述', // 跨模块通用（skill / honors / hobbies description）
  skills: '技能列表',
  proficiencyLevel: '熟练程度',

  // ── honorsCertificates ───────────────────────────────────────────────────
  certificates: '证书列表',

  // ── hobbies ──────────────────────────────────────────────────────────────
  hobbies: '爱好列表',

  // ── selfEvaluation ───────────────────────────────────────────────────────
  content: '内容',

  // ── 通用容器字段 ─────────────────────────────────────────────────────────
  items: '条目',
}

/** 不展示给用户的技术字段 */
export const HIDDEN_DIFF_FIELDS = new Set<string>(['entryId', 'hidden', 'displayType'])

/**
 * 根据字段 key 返回对应中文名；若无映射则原样返回 key。
 */
export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}
