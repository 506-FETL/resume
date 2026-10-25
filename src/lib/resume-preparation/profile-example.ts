import type { ORDERType, ResumeSchema, VisibilityFormType } from '@/lib/schema'
import type { ResumeProfile } from './types'
import { createBlankResume } from '@/lib/resume-import/parse'
import { textToResumeHtml } from '@/lib/resume-import/text'
import { DEFAULT_ORDER } from '@/lib/schema'
import { createResumeEntryId } from '@/lib/schema/resume/entry-id'
import { PROFILE_GUIDES } from './const'

export function createProfileExample(
  profile: ResumeProfile,
): ResumeSchema & { order: ORDERType[]; visibility: VisibilityFormType } {
  const resume = createBlankResume()
  const graduate = profile === 'graduate'
  const careerChange = profile === 'career-change'
  const guide = PROFILE_GUIDES[profile]

  resume.basics.name = '陈晨（示例）'
  resume.basics.phone = '13800000000'
  resume.basics.email = `${profile}@example.com`
  resume.basics.workYears = graduate ? '应届' : '3-5年'
  resume.job_intent.jobIntent = graduate
    ? '前端开发工程师'
    : careerChange
      ? '产品经理'
      : '客户运营专员'
  resume.edu_background.items = [
    {
      entryId: createResumeEntryId(),
      hidden: false,
      schoolName: '知行大学（示例）',
      professional: graduate ? '计算机科学与技术' : '工商管理',
      degree: '本科',
      duration: graduate ? ['2022-09', '2026-06'] : ['2017-09', '2021-06'],
      eduInfo: textToResumeHtml(
        graduate
          ? '学习程序设计、数据库与软件工程，通过课程项目练习需求整理、页面开发和团队协作。'
          : '学习管理学、市场营销与统计学，完成用户调研与业务分析课程实践。',
      ),
    },
  ]

  if (graduate) {
    resume.internship_experience.items = [
      {
        entryId: createResumeEntryId(),
        hidden: false,
        companyName: '知行科技公司（示例）',
        position: '前端开发实习生',
        internshipDuration: ['2025-07', '2025-09'],
        internshipInfo: textToResumeHtml(
          '协助开发活动报名页面，按设计稿完成表单与状态提示，配合同事检查不同屏幕下的显示并修复反馈问题。',
        ),
      },
    ]
  } else {
    resume.work_experience.items = [
      {
        entryId: createResumeEntryId(),
        hidden: false,
        companyName: careerChange
          ? '知行生活服务公司（示例）'
          : '知行客户服务公司（示例）',
        position: careerChange ? '用户运营专员' : '客户运营专员',
        workDuration: ['2021-07', '2026-06'],
        workInfo: textToResumeHtml(
          careerChange
            ? '负责用户反馈整理与活动运营，将重复出现的问题归纳为需求清单，参与产品讨论，协助确认功能上线后的使用情况。'
            : guide.example,
        ),
      },
    ]
  }

  resume.project_experience.items = [
    {
      entryId: createResumeEntryId(),
      hidden: false,
      projectName: graduate
        ? '校园活动报名系统（示例）'
        : careerChange
          ? '用户反馈处理流程改进（示例）'
          : '客户问题知识库建设（示例）',
      participantRole: graduate
        ? '前端开发'
        : careerChange
          ? '需求整理与流程设计'
          : '项目协调与内容整理',
      projectDuration: graduate
        ? ['2025-10', '2025-12']
        : ['2025-03', '2025-06'],
      projectInfo: textToResumeHtml(
        graduate || careerChange
          ? guide.example
          : '整理客服常见问题与已有处理记录，和业务同事核对答复口径，建立分类目录与更新流程，供团队日常查询和新人学习。',
      ),
    },
  ]
  resume.skill_specialty.description = textToResumeHtml(
    graduate
      ? '使用 HTML、CSS、JavaScript 和 React 完成页面开发，了解 Git 协作与常见浏览器调试方法。'
      : careerChange
        ? '能够整理用户访谈与反馈，绘制业务流程和页面原型，编写需求说明并与开发、运营同事沟通。'
        : '熟悉客户反馈分类、问题跟进与知识库维护，能够使用电子表格整理数据并编写业务说明。',
  )

  const priority: ORDERType[] = graduate
    ? [
        'basics',
        'job_intent',
        'edu_background',
        'internship_experience',
        'project_experience',
        'skill_specialty',
      ]
    : careerChange
      ? [
          'basics',
          'job_intent',
          'project_experience',
          'work_experience',
          'skill_specialty',
          'edu_background',
        ]
      : [
          'basics',
          'job_intent',
          'work_experience',
          'project_experience',
          'skill_specialty',
          'edu_background',
        ]

  const order = [
    ...priority,
    ...DEFAULT_ORDER.filter((key) => !priority.includes(key)),
  ]

  const visibility: VisibilityFormType = {
    job_intent: false,
    application_info: true,
    edu_background: false,
    work_experience: graduate,
    internship_experience: !graduate,
    campus_experience: true,
    project_experience: false,
    skill_specialty: false,
    honors_certificates: true,
    self_evaluation: true,
    hobbies: true,
  }

  return { ...resume, order, visibility }
}
