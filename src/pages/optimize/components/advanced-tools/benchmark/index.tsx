import type { ResumeToolContext } from '../shared/types'
import type { BenchmarkMetric } from './types'
import { AlignLeft, BriefcaseBusiness, Gauge, Sparkles, Target, TrendingUp, TriangleAlert, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { ToolMetaBadge, ToolPanelBody, ToolPanelCard, ToolPanelHeader, ToolStatCard } from '../shared/primitives'
import { getMetricStatusClassName } from '../shared/suggestions'
import { buildBenchmarkReport } from './utils'

interface BenchmarkToolProps {
  resumeContext: ResumeToolContext
}

function getMetricTone(metric: BenchmarkMetric) {
  if (metric.status === 'good') {
    return 'success'
  }

  if (metric.status === 'warn') {
    return 'warning'
  }

  return 'danger'
}

function getMetricIcon(metricKey: string) {
  switch (metricKey) {
    case 'evidenceCount':
      return BriefcaseBusiness
    case 'substantiveRatio':
      return AlignLeft
    case 'impactEvidenceRatio':
      return TrendingUp
    case 'positioningConsistency':
      return Target
    case 'atsScore':
      return Gauge
    default:
      return Gauge
  }
}

function BenchmarkTool({ resumeContext }: BenchmarkToolProps) {
  const benchmarkResult = useMemo(
    () => buildBenchmarkReport(resumeContext.resume, resumeContext.atsConfig?.summary?.overall_score ?? null),
    [resumeContext],
  )

  const goodMetricCount = benchmarkResult.metrics
    .filter(metric => metric.target !== null && metric.status === 'good')
    .length
  const pendingMetricCount = benchmarkResult.metrics
    .filter(metric => metric.target !== null && metric.status !== 'good')
    .length
  const atsMetric = benchmarkResult.metrics.find(metric => metric.key === 'atsScore')

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
        以下指标用于观察现有内容的证据结构，不要求固定模块组合，也不直接参与 ATS 总分。
      </div>
      <ToolPanelCard>
        <ToolPanelHeader
          title={benchmarkResult.profileLabel}
          description={benchmarkResult.summary}
          icon={Gauge}
          badge={<ToolMetaBadge tone={benchmarkResult.profileConfidence >= 60 ? 'primary' : 'warning'}>{`置信度 ${benchmarkResult.profileConfidence}%`}</ToolMetaBadge>}
        />
        <ToolPanelBody className="space-y-4">
          <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
            <ToolStatCard
              label="画像置信度"
              value={`${benchmarkResult.profileConfidence}%`}
              hint="基于关键词命中推断出来的岗位方向"
              icon={Gauge}
              tone={benchmarkResult.profileConfidence >= 60 ? 'primary' : 'warning'}
              badge={<ToolMetaBadge tone={benchmarkResult.profileConfidence >= 60 ? 'primary' : 'warning'}>当前画像</ToolMetaBadge>}
            />
            <ToolStatCard
              label="达标指标"
              value={goodMetricCount}
              hint="达到当前内容参考水平的项"
              icon={Trophy}
              tone="success"
              badge={<ToolMetaBadge tone="success">优势项</ToolMetaBadge>}
            />
            <ToolStatCard
              label="待补指标"
              value={pendingMetricCount}
              hint="建议优先加强的内容指标数量"
              icon={TriangleAlert}
              tone={pendingMetricCount > 0 ? 'warning' : 'success'}
              badge={<ToolMetaBadge tone={pendingMetricCount > 0 ? 'warning' : 'success'}>{pendingMetricCount > 0 ? '优先补强' : '已达标'}</ToolMetaBadge>}
            />
            <ToolStatCard
              label="ATS 总分"
              value={atsMetric?.displayCurrent ?? '0'}
              hint="独立生成的内容自适应 ATS 分数"
              icon={Target}
              tone={atsMetric ? getMetricTone(atsMetric) : 'default'}
              badge={<ToolMetaBadge tone={atsMetric ? getMetricTone(atsMetric) : 'default'}>关键指标</ToolMetaBadge>}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">画像置信度</p>
              <ToolMetaBadge tone={benchmarkResult.profileConfidence >= 60 ? 'primary' : 'warning'}>
                {benchmarkResult.profileConfidence}
                %
              </ToolMetaBadge>
            </div>
            <Progress value={benchmarkResult.profileConfidence} className="h-2 bg-muted" />
            <p className="text-xs leading-5 text-muted-foreground">
              这个画像来自求职意向、技能和经历里的关键词命中，不是强制分类，你可以把它当作当前简历最像的岗位方向。
            </p>
          </div>
        </ToolPanelBody>
      </ToolPanelCard>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {benchmarkResult.metrics.map((metric) => {
          const progressValue = metric.target && metric.target > 0
            ? Math.min(100, Math.round((metric.current / metric.target) * 100))
            : 100
          const Icon = getMetricIcon(metric.key)
          const tone = getMetricTone(metric)

          return (
            <ToolPanelCard
              key={metric.key}
              className={cn(
                metric.status === 'good' && 'border-green-500/15 bg-green-500/5',
                metric.status === 'warn' && 'border-amber-500/15 bg-amber-500/5',
                metric.status === 'missing' && 'border-destructive/15 bg-destructive/5',
              )}
            >
              <ToolPanelBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/80 text-foreground shadow-sm">
                      <Icon className="size-4" />
                    </div>
                    <p className="text-sm font-medium">{metric.label}</p>
                  </div>
                  <ToolMetaBadge tone={tone}>
                    {metric.displayCurrent}
                    {' '}
                    /
                    {' '}
                    {metric.displayTarget}
                  </ToolMetaBadge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{metric.description}</p>
                <Progress value={progressValue} className="mt-4 h-2 bg-muted" />
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', getMetricStatusClassName(metric.status))}>
                    {metric.status === 'good' ? '已达标' : metric.status === 'warn' ? '接近目标' : '明显不足'}
                  </span>
                </div>
              </ToolPanelBody>
            </ToolPanelCard>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ToolPanelCard>
          <ToolPanelHeader
            title="当前优势"
            icon={Trophy}
            badge={<ToolMetaBadge tone="success">{`${benchmarkResult.strengths.length || 1} 条亮点`}</ToolMetaBadge>}
          />
          <ToolPanelBody>
            <div className="space-y-3">
              {benchmarkResult.strengths.length > 0
                ? benchmarkResult.strengths.map(strength => (
                    <div key={strength} className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm leading-6 text-green-800 dark:text-green-200">
                      <Sparkles className="mt-0.5 size-4 shrink-0" />
                      <span>{strength}</span>
                    </div>
                  ))
                : (
                    <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm leading-6 text-green-800 dark:text-green-200">
                      <Sparkles className="mt-0.5 size-4 shrink-0" />
                      <span>当前优势证据还不够集中，可以优先强化最能证明目标能力的真实内容。</span>
                    </div>
                  )}
            </div>
          </ToolPanelBody>
        </ToolPanelCard>

        <ToolPanelCard>
          <ToolPanelHeader
            title="优先补强"
            icon={TriangleAlert}
            badge={<ToolMetaBadge tone="warning">{`${benchmarkResult.recommendations.length || 1} 条建议`}</ToolMetaBadge>}
          />
          <ToolPanelBody>
            <div className="space-y-3">
              {benchmarkResult.recommendations.length > 0
                ? benchmarkResult.recommendations.map(item => (
                    <div key={item} className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))
                : (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                      <span>当前内容证据与参考指标已经比较接近，可以继续打磨定位一致性和表达细节。</span>
                    </div>
                  )}
            </div>
          </ToolPanelBody>
        </ToolPanelCard>
      </div>
    </div>
  )
}

export default BenchmarkTool
