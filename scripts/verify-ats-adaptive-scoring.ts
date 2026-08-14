import type { AtsLlmDraft } from '../src/lib/schema/ats.ts'
import type { ResumeSchema } from '../src/lib/schema/resume/form/index.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ATS_SCORE_TOTAL,
  buildAtsAssessmentInput,
  flattenAssessmentFields,
  getResumeEvidenceStats,
  normalizeAtsEvaluationResult,
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
  const emptyContactInput = buildAtsAssessmentInput(resume)
  assert.equal(emptyContactInput.scope.hasContactMethod, false)
  assert.equal(emptyContactInput.scope.hasCandidateName, true)
  assert.equal(
    flattenAssessmentFields(emptyContactInput)
      .find(field => field.locate.path === 'basics.email')
      ?.requiredWithinEntry,
    false,
  )

  resume.basics.email = 'candidate@example.com'
  assert.equal(buildAtsAssessmentInput(resume).scope.hasContactMethod, true)

  resume.basics.name = 'Granular Resume'
  assert.equal(buildAtsAssessmentInput(resume).scope.hasCandidateName, false)
}

function verifyAlternativeContactMethodIsNotPenalized() {
  const resume = createResume()
  resume.basics.phone = '13800000000'
  const input = buildAtsAssessmentInput(resume)
  const emailField = flattenAssessmentFields(input)
    .find(field => field.locate.path === 'basics.email')
  assert.ok(emailField)

  const draft: AtsLlmDraft = {
    scores: {
      job_match: { score: 20, max: 25 },
      content_completeness: { score: 20, max: 25 },
      impact_quantification: { score: 15, max: 20 },
      ats_parsing: { score: 15, max: 15 },
      format_readability: { score: 12, max: 15 },
    },
    findings: {
      high: [],
      medium: [{
        id: 'M-001',
        type: 'missing_email',
        title: '缺少邮箱',
        locate: emailField.locate,
        why: {
          summary: '已有手机号时不应要求邮箱。',
          evidence: [{
            text: '邮箱为空。',
            rawValue: '',
            locate: emailField.locate,
          }],
        },
        fix: { summary: '补充邮箱', steps: ['补充邮箱'], suggestions: [] },
      }],
      low: [],
    },
  }

  const normalized = normalizeAtsEvaluationResult(draft, input)
  assert.equal(normalized.findings.medium.length, 0)
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

function verifyResultNormalization() {
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
      entryId: 'work-used-1',
      companyName: '示例科技',
      position: '前端开发工程师',
      workDuration: ['2024-01', '至今'],
      workInfo: '<p>负责核心业务交付。</p>',
    },
  ]
  const input = buildAtsAssessmentInput(resume)
  const validField = flattenAssessmentFields(input)
    .find(field => field.locate.path === 'work_experience.items[1].workInfo')
  assert.ok(validField)
  const validLocate = validField.locate
  const invalidLocate = {
    path: 'project_experience.items[0].projectInfo',
    sectionLabel: '项目经历',
    fieldLabel: '项目描述',
    itemLabel: '项目 1',
  }

  const draft: AtsLlmDraft = {
    version: '2.0',
    meta: {
      document_version: 2,
      language: 'zh',
      generated_at: '2026-08-14T00:00:00.000Z',
      mode: 'general_ats_check',
      inputDigest: '',
      rubricVersion: '2.0',
      assessment: {
        candidateProfile: '具有业务交付经验的前端开发候选人',
        inferredTarget: '前端开发工程师',
        basisSummary: '根据已有工作经历综合判断。',
        evaluatedSections: ['伪造模块'],
        evidenceSignals: ['已有核心业务交付经历'],
      },
    },
    readabilityIndex: {
      score: 8,
      scale: { min: 1, max: 10 },
      summary: '表达清楚。',
    },
    scores: {
      job_match: { score: 22, max: 30, rationale: '岗位定位清楚。' },
      content_completeness: { score: 20, max: 20, rationale: '已有工作证据。' },
      impact_quantification: { score: 15, max: 20, rationale: '成果证据仍可加强。' },
      ats_parsing: { score: 12, max: 20, rationale: '关键信息可提取。' },
      format_readability: { score: 13, max: 20, rationale: '表达较清晰。' },
    },
    summary: {
      overall_score: 999,
      grade: '错误等级',
      top_risks: ['不应直接信任'],
      next_actions: [{ title: '强化工作成果', priority: 1, locate: validLocate }],
    },
    todo_items: ['补项目经历'],
    fixChecklist: [],
    findings: {
      high: [{
        id: 'H-any',
        type: 'weak_impact',
        title: '工作成果证据仍可加强',
        locate: validLocate,
        why: {
          summary: '现有描述只有职责，成果不够明确。',
          evidence: [{
            text: '当前描述为“负责核心业务交付”。',
            rawValue: '<p>负责核心业务交付。</p>',
            locate: validLocate,
          }],
        },
        fix: {
          summary: '补充真实的交付结果与影响范围',
          steps: ['说明交付对象', '补充真实结果'],
          suggestions: [{
            kind: 'replace_text',
            valueType: 'html_string',
            locate: validLocate,
            before: '<p>负责核心业务交付。</p>',
            after: '<p>负责核心业务交付（待补充：具体范围和结果）。</p>',
            reason: '补足可验证结果。',
            fixed: false,
          }],
        },
      }],
      medium: [{
        id: 'M-any',
        type: 'missing_project',
        title: '错误的空模块问题',
        locate: invalidLocate,
        why: {
          summary: '不应保留。',
          evidence: [{ text: '空项目。', rawValue: '', locate: invalidLocate }],
        },
        fix: { summary: '补项目', steps: ['补项目'], suggestions: [] },
      }],
      low: [{
        id: 'L-any',
        type: 'mismatched_evidence',
        title: '原文不一致的问题',
        locate: validLocate,
        why: {
          summary: '证据原值不一致。',
          evidence: [{ text: '错误证据。', rawValue: '不是原文', locate: validLocate }],
        },
        fix: { summary: '不应保留', steps: ['不应保留'], suggestions: [] },
      }],
    },
  }

  const normalized = normalizeAtsEvaluationResult(draft, input)
  const findingPaths = Object.values(normalized.findings)
    .flatMap(findings => findings.map(finding => finding.locate.path))

  assert.equal(normalized.summary.overall_score, 82)
  assert.equal(normalized.summary.grade, '优秀')
  assert.equal(normalized.scores.job_match.max, 25)
  assert.equal(normalized.scores.ats_parsing.max, 15)
  assert.deepEqual(normalized.meta.assessment?.evaluatedSections, input.scope.evaluatedSections)
  assert.equal(findingPaths.includes(invalidLocate.path), false)
  assert.equal(findingPaths.includes(validLocate.path), true)
  assert.equal(normalized.findings.low.length, 0)
  assert.deepEqual(normalized.todo_items, ['工作成果证据仍可加强'])
  assert.equal(normalized.fixChecklist.length, 1)
}

function verifyContentEvidenceMetrics() {
  const resume = createResume()
  resume.job_intent.jobIntent = '前端开发工程师'
  resume.work_experience.items = [
    {
      entryId: 'work-rich-0',
      companyName: '示例科技',
      position: '前端开发工程师',
      workDuration: ['2023-01', '2024-01'],
      workInfo: '<p>负责组件平台建设，推动核心模块上线并支撑多个业务团队复用。</p>',
    },
    {
      entryId: 'work-rich-1',
      companyName: '示例网络',
      position: '高级前端开发工程师',
      workDuration: ['2024-02', '至今'],
      workInfo: '<p>主导性能治理与工程化改造，降低页面加载耗时并完成稳定交付。</p>',
    },
  ]

  const stats = getResumeEvidenceStats(resume)
  assert.equal(stats.evidenceCount, 2)
  assert.equal(stats.substantiveRatio, 1)
  assert.equal(stats.impactEvidenceRatio, 1)
  assert.equal(stats.positioningConsistency >= 0.8, true)

  const benchmarkSource = readFileSync(
    new URL('../src/pages/optimize/components/advanced-tools/benchmark/utils.ts', import.meta.url),
    'utf8',
  )
  const previewSource = readFileSync(
    new URL('../src/pages/optimize/components/advanced-tools/shared/resume.ts', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(benchmarkSource, /filledSectionCount|projectCount|certificateCount|selfEvaluationLength/)
  assert.doesNotMatch(benchmarkSource, /补齐项目|补齐证书|补齐自我评价/)
  assert.match(previewSource, /\.filter\(item => \[item\.projectName, item\.participantRole, item\.projectDuration, item\.projectInfo\]/)
  assert.match(previewSource, /candidateName\.toLowerCase\(\) === 'granular resume'/)
}

verifyEmptyOptionalSectionsAreNeutral()
verifyOriginalIndexesArePreserved()
verifyExperienceSectionsCanSubstituteForWork()
verifyContactSignal()
verifyAlternativeContactMethodIsNotPenalized()
verifyAdaptivePromptContract()
verifyResultNormalization()
verifyContentEvidenceMetrics()

console.warn('ATS adaptive scoring verification passed.')
