import type { ResumeToolContext } from '../shared/types'
import type { BenchmarkMetric } from './types'
import {
  AlignLeft,
  BriefcaseBusiness,
  Gauge,
  Sparkles,
  Target,
  TrendingUp,
  TriangleAlert,
  Trophy,
} from 'lucide-react'
import { useMemo } from 'react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  ToolMetaBadge,
  ToolPanelBody,
  ToolPanelCard,
  ToolPanelHeader,
  ToolStatCard,
  ToolStatsGrid,
} from '../shared/primitives'
import { getMetricStatusClassName } from '../shared/suggestions'
import { buildBenchmarkReport } from './utils'

interface BenchmarkToolProps {
  resumeContext: ResumeToolContext
}

function getMetricTone(metric: BenchmarkMetric) {
  if (metric.target === null) return 'default'

  if (metric.current >= metric.target) {
    return 'success'
  }

  if (metric.status !== 'missing') {
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
    () =>
      buildBenchmarkReport(
        resumeContext.resume,
        resumeContext.atsConfig?.summary?.overall_score ?? null,
      ),
    [resumeContext],
  )

  const goodMetricCount = benchmarkResult.metrics.filter(
    (metric) => metric.target !== null && metric.current >= metric.target,
  ).length

  const pendingMetricCount = benchmarkResult.metrics.filter(
    (metric) => metric.target !== null && metric.current < metric.target,
  ).length

  const atsMetric = benchmarkResult.metrics.find(
    (metric) => metric.key === 'atsScore',
  )

  return (
    <div className='space-y-8'>
      <div className='max-w-[75ch] text-sm leading-6 text-muted-foreground'>
        这些参考值是我们预设的，用来提醒你检查简历内容，不是招聘要求或行业统计。
        你不需要填满所有模块，这些指标也不会改变 ATS 总分或预测筛选结果。
      </div>
      <ToolPanelCard>
        <ToolPanelHeader
          title={benchmarkResult.profileLabel}
          description={benchmarkResult.summary}
          icon={Gauge}
          badge={
            <ToolMetaBadge
              tone={'default'}
            >{`关键词覆盖 ${benchmarkResult.keywordCoverage}%`}</ToolMetaBadge>
          }
        />
        <ToolPanelBody className='space-y-4'>
          <ToolStatsGrid>
            <ToolStatCard
              label='关键词覆盖率'
              value={`${benchmarkResult.keywordCoverage}%`}
              icon={Gauge}
              tone={'default'}
              badge={
                <ToolMetaBadge tone={'default'}>用于识别岗位</ToolMetaBadge>
              }
            />
            <ToolStatCard
              label='达到参考值'
              value={goodMetricCount}
              icon={Trophy}
              tone='success'
              badge={<ToolMetaBadge tone='success'>已达到</ToolMetaBadge>}
            />
            <ToolStatCard
              label='低于参考值'
              value={pendingMetricCount}
              icon={TriangleAlert}
              tone={pendingMetricCount > 0 ? 'warning' : 'success'}
              badge={
                <ToolMetaBadge
                  tone={pendingMetricCount > 0 ? 'warning' : 'success'}
                >
                  {pendingMetricCount > 0 ? '建议检查' : '达到参考值'}
                </ToolMetaBadge>
              }
            />
            <ToolStatCard
              label='ATS 总分'
              value={atsMetric?.displayCurrent ?? '0'}
              icon={Target}
              tone={atsMetric ? getMetricTone(atsMetric) : 'default'}
              badge={
                <ToolMetaBadge
                  tone={atsMetric ? getMetricTone(atsMetric) : 'default'}
                >
                  关键指标
                </ToolMetaBadge>
              }
            />
          </ToolStatsGrid>

          <div className='space-y-3 border-t border-border/60 pt-4'>
            <div className='flex items-center justify-between gap-3'>
              <p className='text-sm font-medium'>关键词覆盖率</p>
              <ToolMetaBadge tone={'default'}>
                {benchmarkResult.keywordCoverage}%
              </ToolMetaBadge>
            </div>
            <Progress
              value={benchmarkResult.keywordCoverage}
              className='h-2 bg-muted'
            />
            <p className='text-xs leading-5 text-muted-foreground'>
              我们为每类岗位列了一组关键词。这个比例表示你的简历出现了其中多少词，只用来判断参考哪个岗位，不代表你的能力高低。
            </p>
          </div>
        </ToolPanelBody>
      </ToolPanelCard>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8'>
        {benchmarkResult.metrics.map((metric) => {
          const progressValue =
            metric.target && metric.target > 0
              ? Math.min(
                  100,
                  Math.round((metric.current / metric.target) * 100),
                )
              : 0

          const Icon = getMetricIcon(metric.key)
          const tone = getMetricTone(metric)

          const status =
            metric.target === null
              ? null
              : metric.current >= metric.target
                ? 'good'
                : metric.status === 'missing'
                  ? 'missing'
                  : 'warn'

          return (
            <ToolPanelCard key={metric.key}>
              <ToolPanelBody>
                <div className='flex items-start justify-between gap-3'>
                  <div className='flex items-center gap-2'>
                    <div className='shrink-0 text-muted-foreground'>
                      <Icon className='size-4' />
                    </div>
                    <p className='text-sm font-medium'>{metric.label}</p>
                  </div>
                  <ToolMetaBadge tone={tone}>
                    {metric.displayCurrent} / {metric.displayTarget}
                  </ToolMetaBadge>
                </div>
                <p className='text-sm leading-6 text-muted-foreground'>
                  {metric.description}
                </p>
                <Progress value={progressValue} className='mt-4 h-2 bg-muted' />
                <div className='mt-4 flex flex-wrap gap-2'>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
                      status
                        ? getMetricStatusClassName(status)
                        : 'text-muted-foreground',
                    )}
                  >
                    {status === null
                      ? '尚未评估'
                      : status === 'good'
                        ? '达到参考值'
                        : status === 'warn'
                          ? '建议检查'
                          : '低于参考值'}
                  </span>
                </div>
              </ToolPanelBody>
            </ToolPanelCard>
          )
        })}
      </div>

      <div className='grid gap-6 lg:grid-cols-2 lg:gap-8'>
        <ToolPanelCard>
          <ToolPanelHeader
            title='已达到参考值'
            icon={Trophy}
            badge={
              <ToolMetaBadge tone='success'>{`${benchmarkResult.strengths.length} 项`}</ToolMetaBadge>
            }
          />
          <ToolPanelBody>
            <div className='space-y-3'>
              {benchmarkResult.strengths.length > 0 ? (
                benchmarkResult.strengths.map((strength) => (
                  <div
                    key={strength}
                    className='flex items-start gap-3 text-sm leading-6 text-green-800 dark:text-green-200'
                  >
                    <Sparkles className='mt-0.5 size-4 shrink-0' />
                    <span>{strength}</span>
                  </div>
                ))
              ) : (
                <div className='flex items-start gap-3 text-sm leading-6 text-muted-foreground'>
                  <Sparkles className='mt-0.5 size-4 shrink-0' />
                  <span>
                    暂时没有达到参考值的项目。可以先检查经历是否写完整，不必为了凑数添加内容。
                  </span>
                </div>
              )}
            </div>
          </ToolPanelBody>
        </ToolPanelCard>

        <ToolPanelCard>
          <ToolPanelHeader
            title='修改建议'
            icon={TriangleAlert}
            badge={
              <ToolMetaBadge tone='warning'>{`${benchmarkResult.recommendations.length || 1} 条建议`}</ToolMetaBadge>
            }
          />
          <ToolPanelBody>
            <div className='space-y-3'>
              {benchmarkResult.recommendations.length > 0 ? (
                benchmarkResult.recommendations.map((item) => (
                  <div
                    key={item}
                    className='flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-200'
                  >
                    <TriangleAlert className='mt-0.5 size-4 shrink-0' />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <div className='flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-200'>
                  <TriangleAlert className='mt-0.5 size-4 shrink-0' />
                  <span>
                    这些项目都已达到参考值。接下来可以通读一遍，检查内容是否准确、好读。
                  </span>
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
