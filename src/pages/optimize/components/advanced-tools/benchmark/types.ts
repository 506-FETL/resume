export interface BenchmarkTargets {
  evidenceCount: number
  substantiveRatio: number
  impactEvidenceRatio: number
  positioningConsistency: number
  atsScore: number | null
}

export interface BenchmarkProfile {
  key: string
  label: string
  keywords: string[]
  targets: BenchmarkTargets
}

export type BenchmarkMetricStatus = 'good' | 'warn' | 'missing'

export interface BenchmarkMetric {
  key: string
  label: string
  current: number
  target: number | null
  displayCurrent: string
  displayTarget: string
  status: BenchmarkMetricStatus
  description: string
}

export interface BenchmarkResult {
  profileKey: string
  profileLabel: string
  profileConfidence: number
  summary: string
  metrics: BenchmarkMetric[]
  strengths: string[]
  recommendations: string[]
}
