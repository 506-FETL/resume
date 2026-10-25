import type { ORDERType } from '@/lib/schema'
import type { ResumeProfile } from './types'

export const SECTION_LABELS: Record<ORDERType, string> = {
  basics: '基本信息',
  job_intent: '求职意向',
  application_info: '报考信息',
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

export const PROFILE_GUIDES: Record<
  ResumeProfile,
  {
    label: string
    section: ORDERType
    steps: string[]
    example: string
  }
> = {
  graduate: {
    label: '应届生',
    section: 'project_experience',
    steps: [
      '写清学校、专业和毕业时间。',
      '选 1～2 段与目标岗位相关的实习或项目。',
      '每段写清你负责什么、做了什么、有什么结果。',
    ],
    example:
      '在课程项目中负责需求整理和页面开发，完成报名表单与结果展示，并根据同学试用反馈调整操作流程。',
  },
  experienced: {
    label: '有工作经验',
    section: 'work_experience',
    steps: [
      '从最近一份工作写起。',
      '选有代表性的工作，写清职责、做法和结果。',
      '成果数字要有依据，没有数据就描述实际变化。',
    ],
    example:
      '负责客户反馈的分类与跟进，每周整理常见问题，与产品和开发同事确认处理方案，并回访问题是否解决。',
  },
  'career-change': {
    label: '准备转岗',
    section: 'project_experience',
    steps: [
      '先明确你想申请的岗位。',
      '挑出与新岗位相关的工作或项目。',
      '用具体做法说明已有经验能怎样用在新岗位上。',
    ],
    example:
      '在运营工作中整理用户反馈，参与需求讨论并绘制操作流程；通过实际使用反馈修正方案，逐步积累产品设计经验。',
  },
}
