import type { BenchmarkMetric, BenchmarkMetricStatus, BenchmarkResult } from './types'
import type { ResumeSchema } from '@/lib/schema'
import { getResumeEvidenceStats } from '@/lib/ats'
import { normalizeMultilineText } from '../shared/text'
import { BENCHMARK_PROFILES, GENERAL_BENCHMARK_PROFILE } from './const'

function inferBenchmarkProfile(resume: ResumeSchema) {
  const referenceText = [
    resume.job_intent.jobIntent,
    ...resume.skill_specialty.skills.map(skill => skill.label),
    ...resume.work_experience.items.map(item => `${item.position} ${item.workInfo}`),
    ...resume.internship_experience.items.map(item => `${item.position} ${item.internshipInfo}`),
    ...resume.project_experience.items.map(item => `${item.projectName} ${item.participantRole} ${item.projectInfo}`),
    ...resume.campus_experience.items.map(item => `${item.experienceName} ${item.role} ${item.campusInfo}`),
  ]
    .map(text => normalizeMultilineText(text).toLowerCase())
    .join('\n')

  const rankedProfiles = BENCHMARK_PROFILES
    .map(profile => ({ profile, score: profile.keywords.filter(keyword => referenceText.includes(keyword)).length }))
    .sort((a, b) => b.score - a.score)

  const winner = rankedProfiles[0]
  if (!winner || winner.score === 0) {
    return { confidence: 0, profile: GENERAL_BENCHMARK_PROFILE }
  }

  return {
    confidence: Math.min(100, Math.round((winner.score / winner.profile.keywords.length) * 100)),
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
  const formatter = config.formatter ?? (value => `${value ?? 0}`)
  const ratio = config.target && config.target > 0 ? config.current / config.target : 1

  let status: BenchmarkMetricStatus = 'good'
  if (config.target !== null) {
    if (ratio < 0.5)
      status = 'missing'
    else if (ratio < 0.9)
      status = 'warn'
  }

  return {
    key: config.key,
    label: config.label,
    current: config.current,
    target: config.target,
    displayCurrent: formatter(config.current),
    displayTarget: config.target === null ? '仅供参考' : formatter(config.target),
    status,
    description: config.description,
  }
}

function formatPercent(value: number | null) {
  return `${Math.round((value ?? 0) * 100)}%`
}

export function buildBenchmarkReport(resume: ResumeSchema, overallScore: number | null): BenchmarkResult {
  const { confidence, profile } = inferBenchmarkProfile(resume)
  const stats = getResumeEvidenceStats(resume)
  const metrics = [
    createBenchmarkMetric({
      key: 'evidenceCount',
      label: '有效能力证据',
      current: stats.evidenceCount,
      target: profile.targets.evidenceCount,
      description: '汇总教育、工作、实习、校园和项目中真实存在的有效内容，不要求固定模块组合。',
    }),
    createBenchmarkMetric({
      key: 'substantiveRatio',
      label: '实质描述比例',
      current: stats.substantiveRatio,
      target: profile.targets.substantiveRatio,
      formatter: formatPercent,
      description: '现有经历中包含具体职责、行动或范围描述的比例。',
    }),
    createBenchmarkMetric({
      key: 'impactEvidenceRatio',
      label: '成果或影响证据',
      current: stats.impactEvidenceRatio,
      target: profile.targets.impactEvidenceRatio,
      formatter: formatPercent,
      description: '现有经历中包含交付、结果、影响、规模或数据证据的比例；数字不是唯一证据。',
    }),
    createBenchmarkMetric({
      key: 'positioningConsistency',
      label: '内容定位一致性',
      current: stats.positioningConsistency,
      target: profile.targets.positioningConsistency,
      formatter: formatPercent,
      description: '求职方向、岗位角色、项目职责和技能关键词是否形成一致定位。',
    }),
    createBenchmarkMetric({
      key: 'atsScore',
      label: 'ATS 综合评分',
      current: overallScore ?? 0,
      target: overallScore === null ? null : profile.targets.atsScore,
      formatter: value => overallScore === null ? '未生成' : `${value ?? 0}`,
      description: overallScore === null
        ? '尚未生成 ATS 报告，此项暂不参与基准判断。'
        : '当前内容自适应 ATS 报告的综合评分。',
    }),
  ]

  const strengths = metrics
    .filter(metric => metric.status === 'good' && metric.key !== 'atsScore')
    .slice(0, 3)
    .map(metric => `${metric.label}达到${profile.label}的内容参考水平，当前为 ${metric.displayCurrent}。`)

  const recommendations = metrics
    .filter(metric => metric.status !== 'good')
    .slice(0, 4)
    .map((metric) => {
      if (metric.key === 'evidenceCount')
        return '现有能力证据偏少，可以在最能证明目标能力的真实经历中补充职责、交付物或作品证据。'
      if (metric.key === 'substantiveRatio')
        return '部分现有经历表达偏薄，优先说明你做了什么、负责到什么范围以及采用了什么方法。'
      if (metric.key === 'impactEvidenceRatio')
        return '成果支撑偏弱，优先补充真实的交付结果、影响范围、问题解决情况或可验证数据。'
      if (metric.key === 'positioningConsistency')
        return '内容定位较分散，建议围绕目标方向统一岗位表述、能力关键词和经历重点。'
      return 'ATS 综合评分仍有提升空间，优先处理当前报告中有原文证据的问题。'
    })

  const pendingLabels = metrics
    .filter(metric => metric.status !== 'good')
    .slice(0, 2)
    .map(metric => metric.label)

  return {
    profileKey: profile.key,
    profileLabel: profile.label,
    profileConfidence: confidence,
    summary: pendingLabels.length > 0
      ? `${profile.label}内容画像下，当前更值得加强的是${pendingLabels.join('、')}。`
      : `${profile.label}内容画像下，现有证据结构较完整，可以继续打磨表达细节。`,
    metrics,
    strengths,
    recommendations,
  }
}
