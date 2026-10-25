import type { ReviewModule } from './types'

export const REVIEW_MODULES: ReviewModule[] = [
  {
    section: 'basics',
    fields: [
      { key: 'name', label: '姓名' },
      { key: 'phone', label: '手机' },
      { key: 'email', label: '邮箱' },
    ],
  },
  {
    section: 'job_intent',
    fields: [
      { key: 'jobIntent', label: '目标岗位' },
      { key: 'intentionalCity', label: '意向城市' },
    ],
  },
  {
    section: 'edu_background',
    arrayKey: 'items',
    fields: [
      { key: 'schoolName', label: '学校' },
      { key: 'professional', label: '专业' },
      {
        key: 'degree',
        label: '学历',
        kind: 'select',
        options: [
          '不填',
          '初中',
          '高中',
          '中专',
          '大专',
          '本科',
          '学士',
          '硕士',
          '博士',
          'MBA',
          'EMBA',
          '其他',
        ],
      },
      { key: 'duration', label: '起止时间', kind: 'duration' },
      { key: 'eduInfo', label: '补充说明', kind: 'rich' },
    ],
  },
  {
    section: 'work_experience',
    arrayKey: 'items',
    fields: [
      { key: 'companyName', label: '公司' },
      { key: 'position', label: '岗位' },
      { key: 'workDuration', label: '起止时间', kind: 'duration' },
      { key: 'workInfo', label: '工作内容', kind: 'rich' },
    ],
  },
  {
    section: 'internship_experience',
    arrayKey: 'items',
    fields: [
      { key: 'companyName', label: '公司' },
      { key: 'position', label: '岗位' },
      { key: 'internshipDuration', label: '起止时间', kind: 'duration' },
      { key: 'internshipInfo', label: '实习内容', kind: 'rich' },
    ],
  },
  {
    section: 'project_experience',
    arrayKey: 'items',
    fields: [
      { key: 'projectName', label: '项目名称' },
      { key: 'participantRole', label: '担任角色' },
      { key: 'projectDuration', label: '起止时间', kind: 'duration' },
      { key: 'projectInfo', label: '项目内容', kind: 'rich' },
    ],
  },
  {
    section: 'campus_experience',
    arrayKey: 'items',
    fields: [
      { key: 'experienceName', label: '活动名称' },
      { key: 'role', label: '担任角色' },
      { key: 'duration', label: '起止时间', kind: 'duration' },
      { key: 'campusInfo', label: '活动内容', kind: 'rich' },
    ],
  },
  {
    section: 'skill_specialty',
    fields: [{ key: 'description', label: '技能说明', kind: 'rich' }],
  },
  {
    section: 'honors_certificates',
    fields: [{ key: 'description', label: '荣誉证书', kind: 'rich' }],
  },
  {
    section: 'self_evaluation',
    fields: [{ key: 'content', label: '自我评价', kind: 'rich' }],
  },
  {
    section: 'hobbies',
    fields: [{ key: 'description', label: '兴趣爱好', kind: 'rich' }],
  },
  {
    section: 'application_info',
    fields: [
      { key: 'applicationSchool', label: '报考学校' },
      { key: 'applicationMajor', label: '报考专业' },
    ],
  },
]
