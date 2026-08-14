import type { FindingsGroup, Severity } from '../../types'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { isAtsFindingPending } from '@/lib/ats'
import { cn } from '@/lib/utils'
import { severityConfig } from '../../const'
import useAtsStore from '../../store'
import FindingItem from './finding-item'

function countAllFindings(findings: FindingsGroup | undefined) {
  if (!findings) {
    return 0
  }

  return (findings.high?.length || 0) + (findings.medium?.length || 0) + (findings.low?.length || 0)
}

export default function IssueAnalysis() {
  const { currentAtsConfig, loading } = useAtsStore()
  const findings = currentAtsConfig?.findings
  const severityOrder: Severity[] = ['high', 'medium', 'low']

  const pendingCounts = severityOrder.reduce<Record<Severity, number>>((accumulator, severity) => {
    accumulator[severity] = (findings?.[severity] ?? []).filter(isAtsFindingPending).length
    return accumulator
  }, { high: 0, medium: 0, low: 0 })

  const totalPendingIssues = pendingCounts.high + pendingCounts.medium + pendingCounts.low
  const totalFindings = countAllFindings(findings)

  return (
    <Card className="overflow-hidden border-primary/10 shadow-sm">
      <CardHeader className="border-b p-4 md:p-5">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Search className="size-4" />
            </div>
            <span>简历问题分析</span>
          </CardTitle>
          {totalPendingIssues > 0
            ? (
                <Badge variant="outline" className="gap-2 rounded-full border-destructive/30 bg-destructive/5 px-3 py-1 text-destructive transition-colors hover:bg-destructive/10">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                  </span>
                  <span className="font-medium">
                    {totalPendingIssues}
                    {' '}
                    个待处理问题
                  </span>
                </Badge>
              )
            : totalFindings > 0
              ? (
                  <Badge variant="outline" className="rounded-full py-1 px-3 gap-2 border-green-500/30 bg-green-500/5 text-green-700 hover:bg-green-500/10 dark:text-green-300">
                    已全部处理
                  </Badge>
                )
              : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-5">
        {loading
          ? (
              <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
                <Spinner className="size-6 animate-spin text-primary" />
              </div>
            )
          : !findings || totalFindings === 0
              ? (
                  <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-muted-foreground">
                    <div className="mb-3 rounded-full bg-muted/50 p-3">
                      <Search className="size-6 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">暂无检测到的问题</p>
                    <p className="mt-1 text-xs text-muted-foreground/80">您的简历表现良好！</p>
                  </div>
                )
              : severityOrder.map((severity) => {
                  const issues = findings[severity]
                  if (!issues || issues.length === 0)
                    return null

                  const config = severityConfig[severity]
                  const Icon = config.icon
                  const pendingCount = pendingCounts[severity]

                  return (
                    <div key={severity} className="space-y-2.5">
                      <div className="flex items-center gap-2 px-1">
                        <div className={config.textColor}>
                          <Icon className="size-4" />
                        </div>
                        <span className={cn('text-sm font-semibold', config.textColor)}>
                          {config.label}
                        </span>
                        {pendingCount > 0
                          ? (
                              <Badge variant="secondary" className="text-xs rounded-full h-5 px-2 min-w-5 justify-center">
                                {pendingCount}
                              </Badge>
                            )
                          : (
                              <Badge variant="outline" className="h-5 rounded-full border-green-500/30 bg-green-500/5 px-2 text-[10px] font-medium text-green-700 dark:text-green-300">
                                已完成
                              </Badge>
                            )}
                      </div>
                      <div className="space-y-2.5 sm:pl-2">
                        {issues.map(issue => (
                          <FindingItem key={issue.id} id={issue.id} severity={severity} />
                        ))}
                      </div>
                    </div>
                  )
                })}
      </CardContent>
    </Card>
  )
}
