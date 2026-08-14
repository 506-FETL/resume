import type { ResumeSchema } from '../src/lib/schema/resume/form/index.ts'
import assert from 'node:assert/strict'
import {
  ATS_SCORE_TOTAL,
  buildAtsAssessmentInput,
  flattenAssessmentFields,
} from '../src/lib/ats/index.ts'
import { buildOptimizePrompt } from '../src/lib/llm/prompts/optimize.ts'

function createResume(): ResumeSchema {
  return {
    basics: {
      name: '测试候选人',
      gender: '不填',
      birthMonth: '',
      phone: '',
      email: '',
      workYears: '不填',
      maritalStatus: '不填',
      heightCm: 0,
      weightKg: 0,
      nation: '',
      nativePlace: '',
      politicalStatus: '不填',
      customFields: [],
    },
    job_intent: {
      jobIntent: '',
      intentionalCity: '',
      expectedSalary: 0,
      dateEntry: '不填',
    },
    application_info: {
      applicationSchool: '',
      applicationMajor: '',
    },
    edu_background: {
      items: [{
        entryId: 'education-empty',
        schoolName: '',
        professional: '',
        degree: '不填',
        duration: ['', ''],
        eduInfo: '',
      }],
    },
    work_experience: {
      items: [{
        entryId: 'work-empty-0',
        companyName: '',
        position: '',
        workDuration: ['', ''],
        workInfo: '',
      }],
    },
    internship_experience: {
      items: [{
        entryId: 'internship-empty',
        companyName: '',
        position: '',
        internshipDuration: ['', ''],
        internshipInfo: '',
      }],
    },
    campus_experience: {
      items: [{
        entryId: 'campus-empty',
        experienceName: '',
        role: '',
        duration: ['', ''],
        campusInfo: '',
      }],
    },
    project_experience: {
      items: [{
        entryId: 'project-empty',
        projectName: '',
        participantRole: '',
        projectDuration: ['', ''],
        projectInfo: '',
      }],
    },
    skill_specialty: {
      description: '',
      skills: [],
    },
    honors_certificates: {
      description: '',
      certificates: [],
    },
    self_evaluation: {
      content: '',
    },
    hobbies: {
      description: '',
      hobbies: [],
    },
  }
}

function verifyEmptyOptionalSectionsAreNeutral() {
  const resume = createResume()
  resume.job_intent.jobIntent = '前端开发工程师'
  resume.work_experience.items = [{
    entryId: 'work-used-0',
    companyName: '示例科技',
    position: '前端开发工程师',
    workDuration: ['', ''],
    workInfo: '<p>负责企业后台的组件化建设与性能优化。</p>',
  }]

  const result = buildAtsAssessmentInput(resume)
  const sectionKeys = result.sections.map(section => section.key)

  assert.equal(sectionKeys.includes('work_experience'), true)
  assert.equal(sectionKeys.includes('project_experience'), false)
  assert.equal(sectionKeys.includes('honors_certificates'), false)
  assert.equal(sectionKeys.includes('self_evaluation'), false)
  assert.equal(result.scope.ignoredEmptySections.includes('项目经历'), true)

  const paths = flattenAssessmentFields(result).map(field => field.locate.path)
  assert.equal(paths.includes('work_experience.items[0].workDuration'), true)
}

function verifyOriginalIndexesArePreserved() {
  const resume = createResume()
  resume.work_experience.items = [
    {
      entryId: 'work-empty-0',
      companyName: '',
      position: '',
      workDuration: ['', ''],
      workInfo: '',
    },
    {
      entryId: 'work-empty-1',
      companyName: '',
      position: '',
      workDuration: ['', ''],
      workInfo: '',
    },
    {
      entryId: 'work-used-2',
      companyName: '第三家公司',
      position: '高级工程师',
      workDuration: ['2024-01', '至今'],
      workInfo: '<p>负责核心业务交付。</p>',
    },
  ]

  const fields = flattenAssessmentFields(buildAtsAssessmentInput(resume))

  assert.equal(
    fields.some(field => field.locate.path === 'work_experience.items[2].workInfo'),
    true,
  )
  assert.equal(
    fields.some(field => field.locate.path === 'work_experience.items[0].workInfo'),
    false,
  )
}

function verifyExperienceSectionsCanSubstituteForWork() {
  const resume = createResume()
  resume.project_experience.items = [{
    entryId: 'project-used-0',
    projectName: '协同编辑器',
    participantRole: '负责人',
    projectDuration: ['2025-01', '2025-06'],
    projectInfo: '<p>负责多人协同与离线容灾设计。</p>',
  }]
  resume.campus_experience.items = [{
    entryId: 'campus-used-0',
    experienceName: '技术社团',
    role: '负责人',
    duration: ['2024-01', '2024-12'],
    campusInfo: '<p>组织技术分享与开源协作。</p>',
  }]

  const result = buildAtsAssessmentInput(resume)
  const sectionKeys = result.sections.map(section => section.key)

  assert.equal(sectionKeys.includes('work_experience'), false)
  assert.equal(sectionKeys.includes('project_experience'), true)
  assert.equal(sectionKeys.includes('campus_experience'), true)
}

function verifyContactSignal() {
  const resume = createResume()
  assert.equal(buildAtsAssessmentInput(resume).scope.hasContactMethod, false)

  resume.basics.email = 'candidate@example.com'
  assert.equal(buildAtsAssessmentInput(resume).scope.hasContactMethod, true)
}

function verifyAdaptivePromptContract() {
  const resume = createResume()
  resume.work_experience.items = [{
    entryId: 'work-used-0',
    companyName: '示例科技',
    position: '工程师',
    workDuration: ['2024-01', '至今'],
    workInfo: '<p>负责核心业务交付。</p>',
  }]

  const prompt = buildOptimizePrompt(buildAtsAssessmentInput(resume))

  assert.equal(ATS_SCORE_TOTAL, 100)
  assert.match(prompt, /未出现在 sections 的模块代表用户没有使用该模板模块/)
  assert.match(prompt, /不得因为该模块缺失而扣分/)
  assert.doesNotMatch(prompt, /"ignoredEmptySections"/)
  assert.doesNotMatch(prompt, /Locate\.path 白名单/)
}

verifyEmptyOptionalSectionsAreNeutral()
verifyOriginalIndexesArePreserved()
verifyExperienceSectionsCanSubstituteForWork()
verifyContactSignal()
verifyAdaptivePromptContract()

console.warn('ATS adaptive scoring verification passed.')
