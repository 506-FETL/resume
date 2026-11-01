import type { Severity } from '../../types'
import { Search } from 'lucide-react'
import AnimatedContent from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { isAtsFindingPending } from '@/lib/ats'
import useAtsStore from '../../store'
import FindingItem from './finding-item'

const severityOrder: Severity[] = ['high', 'medium', 'low']

export default function IssueAnalysis() {
  const { currentAtsConfig, loading, loadError, analysisError } = useAtsStore()
  const findings = currentAtsConfig?.findings

  const allFindings = severityOrder.flatMap((severity) =>
    (findings?.[severity] ?? []).map((finding) => ({ finding, severity })),
  )

  const pendingFindings = allFindings.filter(({ finding }) =>
    isAtsFindingPending(finding),
  )

  const firstPending = pendingFindings[0]

  const orderedFindings = firstPending
    ? [firstPending, ...allFindings.filter((entry) => entry !== firstPending)]
    : allFindings

  const totalPendingIssues = pendingFindings.length
  const totalFindings = allFindings.length
  const hasError = !currentAtsConfig && Boolean(loadError || analysisError)

  return (
    <div className='min-w-0'>
      <header className='flex flex-wrap items-center justify-between gap-3 pb-4'>
        <h2 className='text-lg font-semibold tracking-tight'>问题分析</h2>
        {totalPendingIssues > 0 ? (
          <p className='text-sm text-muted-foreground'>
            <span className='font-medium text-foreground tabular-nums'>
              {totalPendingIssues}
            </span>{' '}
            项待处理
          </p>
        ) : totalFindings > 0 ? (
          <Badge
            variant='outline'
            className='rounded-full border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-300'
          >
            已全部处理
          </Badge>
        ) : null}
      </header>
      <AnimatedContent
        animationKey={
          loading
            ? 'loading'
            : hasError
              ? 'error'
              : !currentAtsConfig
                ? 'unassessed'
                : totalFindings === 0
                  ? 'empty'
                  : 'findings'
        }
        className='min-w-0'
      >
        {loading ? (
          <div
            role='status'
            className='flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground'
          >
            <Spinner className='size-5 text-primary motion-reduce:animate-none' />
            正在读取检测报告
          </div>
        ) : !findings || totalFindings === 0 ? (
          <div className='flex flex-col items-center justify-center px-4 py-8 text-center text-muted-foreground'>
            <Search aria-hidden className='mb-3 size-6 opacity-40' />
            <p className='text-sm font-medium'>
              {hasError
                ? '暂时无法查看问题分析'
                : currentAtsConfig
                  ? '本次检测未发现问题'
                  : '尚未生成检测结果'}
            </p>
            {!currentAtsConfig && !hasError && (
              <p className='mt-2 text-sm'>
                选择简历并开始检测后，这里会按优先级展示问题。
              </p>
            )}
          </div>
        ) : (
          <div className='min-w-0'>
            {orderedFindings.map(({ finding, severity }, index) => (
              <FindingItem
                key={`${currentAtsConfig?.id}:${severity}:${finding.id}`}
                id={finding.id}
                severity={severity}
                featured={index === 0 && totalPendingIssues > 0}
              />
            ))}
          </div>
        )}
      </AnimatedContent>
    </div>
  )
}
