import type { FindingsGroup, Severity } from '../../types'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { severityConfig } from '../../const'
import useAtsStore from '../../store'
import FindingItem from './finding-item'

export function IssueAnalysis() {
  const { currentAtsConfig, loading } = useAtsStore()
  const [findings, setFindings] = useState<FindingsGroup>()

  useEffect(() => {
    if (loading || !currentAtsConfig)
      return

    setFindings(currentAtsConfig.findings)
  }, [currentAtsConfig, loading])

  const severityOrder: Severity[] = ['high', 'medium', 'low']
  const totalIssues = findings
    ? (findings.high?.length || 0) + (findings.medium?.length || 0) + (findings.low?.length || 0)
    : 0

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
          </div>
          <span>简历问题深度分析</span>
          {totalIssues > 0 && (
            <Badge variant="secondary" className="text-[10px] sm:text-xs rounded-full">
              {totalIssues}
              个问题
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-5 pt-0">
        {loading
          ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Spinner className="size-6 mb-3" />
              </div>
            )
          : !findings || totalIssues === 0
              ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Search className="size-10 mb-3 opacity-40" />
                    <p className="text-sm">暂无检测到的问题</p>
                  </div>
                )
              : severityOrder.map((severity) => {
                  const issues = findings[severity]
                  if (!issues || issues.length === 0)
                    return null

                  const config = severityConfig[severity]
                  const Icon = config.icon

                  return (
                    <div key={severity} className="space-y-2.5 sm:space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <Icon className={cn('size-4', config.textColor)} />
                        <span className={cn('text-xs sm:text-sm font-semibold', config.textColor)}>
                          {config.label}
                        </span>
                        <Badge className={cn('text-[10px] sm:text-xs rounded-full', config.badgeBg, config.badgeText, 'border-transparent')}>
                          {issues.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {issues.map(issue => (
                          <FindingItem key={issue.id} finding={issue} severity={severity} />
                        ))}
                      </div>
                    </div>
                  )
                })}
      </CardContent>
    </Card>
  )
}
