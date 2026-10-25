import type {
  BenchmarkMetric,
  BenchmarkMetricStatus,
  BenchmarkResult,
} from './types'
import type { ResumeSchema } from '@/lib/schema'
import { getResumeEvidenceStats } from '@/lib/ats'
import { normalizeMultilineText } from '../shared/text'
import { BENCHMARK_PROFILES, GENERAL_BENCHMARK_PROFILE } from './const'

function inferBenchmarkProfile(resume: ResumeSchema) {
  const referenceText = [
    resume.job_intent.jobIntent,
    ...resume.skill_specialty.skills.map((skill) => skill.label),
    ...resume.work_experience.items.map(
      (item) => `${item.position} ${item.workInfo}`,
    ),
    ...resume.internship_experience.items.map(
      (item) => `${item.position} ${item.internshipInfo}`,
    ),
    ...resume.project_experience.items.map(
      (item) =>
        `${item.projectName} ${item.participantRole} ${item.projectInfo}`,
    ),
    ...resume.campus_experience.items.map(
      (item) => `${item.experienceName} ${item.role} ${item.campusInfo}`,
    ),
  ]
    .map((text) => normalizeMultilineText(text).toLowerCase())
    .join('\n')

  const rankedProfiles = BENCHMARK_PROFILES.map((profile) => ({
    profile,
    score: profile.keywords.filter((keyword) => referenceText.includes(keyword))
      .length,
  })).sort((a, b) => b.score - a.score)

  const winner = rankedProfiles[0]

  if (!winner || winner.score === 0) {
    return { coverage: 0, profile: GENERAL_BENCHMARK_PROFILE }
  }

  return {
    coverage: Math.min(
      100,
      Math.round((winner.score / winner.profile.keywords.length) * 100),
    ),
    profile: winner.profile,
  }
}

function createBenchmarkMetric(config: {
  current: number
  description: string
  formatter?: (value: number | null) => string
  key: string
  label: string
  target: number | null
}): BenchmarkMetric {
  const formatter = config.formatter ?? ((value) => `${value ?? 0}`)

  const ratio =
    config.target && config.target > 0 ? config.current / config.target : 1

  let status: BenchmarkMetricStatus = 'good'

  if (config.target !== null) {
    if (ratio < 0.5) status = 'missing'
    else if (ratio < 1) status = 'warn'
  }

  return {
    key: config.key,
    label: config.label,
    current: config.current,
    target: config.target,
    displayCurrent: formatter(config.current),
    displayTarget:
      config.target === null ? '仅供参考' : formatter(config.target),
    status,
    description: config.description,
  }
}

function formatPercent(value: number | null) {
  return `${Math.round((value ?? 0) * 100)}%`
}

export function buildBenchmarkReport(
  resume: ResumeSchema,
  overallScore: number | null,
): BenchmarkResult {
  const { coverage, profile } = inferBenchmarkProfile(resume)
  const stats = getResumeEvidenceStats(resume)

  const metrics = [
    createBenchmarkMetric({
      key: 'evidenceCount',
      label: '已填写的经历',
      current: stats.evidenceCount,
      target: profile.targets.evidenceCount,
      description:
        '统计填写过内容的教育、工作、实习、校园和项目经历，不要求每个模块都填写。',
    }),
    createBenchmarkMetric({
      key: 'substantiveRatio',
      label: '具体描述占比',
      current: stats.substantiveRatio,
      target: profile.targets.substantiveRatio,
      formatter: formatPercent,
      description:
        '有多少经历写出了你具体做过什么、负责什么。此项按描述长度和行动用词估算。',
    }),
    createBenchmarkMetric({
      key: 'impactEvidenceRatio',
      label: '成果描述占比',
      current: stats.impactEvidenceRatio,
      target: profile.targets.impactEvidenceRatio,
      formatter: formatPercent,
      description:
        '有多少经历提到了完成的工作、带来的变化或相关数据。此项按用词识别，没有数字也可以写成果。',
    }),
    createBenchmarkMetric({
      key: 'positioningConsistency',
      label: '求职方向一致性',
      current: stats.positioningConsistency,
      target: profile.targets.positioningConsistency,
      formatter: formatPercent,
      description:
        '检查求职意向与岗位名称、项目角色、技能是否有相同用词；没填求职意向时，比较这些内容之间的共同用词。',
    }),
    createBenchmarkMetric({
      key: 'atsScore',
      label: 'ATS 综合评分',
      current: overallScore ?? 0,
      target: overallScore === null ? null : profile.targets.atsScore,
      formatter: (value) =>
        overallScore === null ? '未生成' : `${value ?? 0}`,
      description:
        overallScore === null
          ? '还没有 ATS 报告，暂时无法比较这一项。'
          : '这里显示你已有 ATS 报告中的总分。',
    }),
  ]

  const strengths = metrics
    .filter((metric) => metric.status === 'good' && metric.key !== 'atsScore')
    .slice(0, 3)
    .map(
      (metric) =>
        `${metric.label}为 ${metric.displayCurrent}，已达到参考值 ${metric.displayTarget}。`,
    )

  const recommendations = metrics
    .filter((metric) => metric.status !== 'good')
    .slice(0, 4)
    .map((metric) => {
      if (metric.key === 'evidenceCount')
        return '写出的经历较少。如果还有相关的工作、项目或校园经历，可以补充进去。'
      if (metric.key === 'substantiveRatio')
        return '有些经历写得比较笼统。可以补充你负责哪部分、具体做了什么、用了什么方法。'
      if (metric.key === 'impactEvidenceRatio')
        return '可以再写写工作的结果：完成了什么，解决了什么问题。有数据就写数据，没有也不用硬凑。'
      if (metric.key === 'positioningConsistency')
        return '求职意向和经历中的相关用词较少。检查是否漏写了相关经验和技能，不必为了匹配改动事实。'

      return '可以打开 ATS 报告，对照原文看看哪些问题需要修改。'
    })

  const pendingLabels = metrics
    .filter((metric) => metric.status !== 'good')
    .slice(0, 2)
    .map((metric) => metric.label)

  return {
    profileKey: profile.key,
    profileLabel: profile.label,
    keywordCoverage: coverage,
    summary:
      pendingLabels.length > 0
        ? `可以先检查${pendingLabels.join('、')}，看看有没有遗漏的内容。`
        : '这些项目已达到参考值，可以再检查一下内容是否准确、好读。',
    metrics,
    strengths,
    recommendations,
  }
}
