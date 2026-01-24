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

export default function IssueAnalysis() {
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
    <Card className="overflow-hidden shadow-sm border-primary/10">
      <CardHeader className="pb-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Search className="w-4 h-4" />
            </div>
            <span>简历问题分析</span>
          </CardTitle>
          {totalIssues > 0 && (
            <Badge variant="outline" className="rounded-full py-1 px-3 gap-2 border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
              </span>
              <span className="font-medium">
                {totalIssues}
                {' '}
                个待处理问题
              </span>
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {loading
          ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
                <Spinner className="w-6 h-6 animate-spin text-primary" />
              </div>
            )
          : !findings || totalIssues === 0
              ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <div className="p-4 bg-muted/50 rounded-full mb-3">
                      <Search className="w-8 h-8 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">暂无检测到的问题</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">您的简历表现良好！</p>
                  </div>
                )
              : severityOrder.map((severity) => {
                  const issues = findings[severity]
                  if (!issues || issues.length === 0)
                    return null

                  const config = severityConfig[severity]
                  const Icon = config.icon

                  return (
                    <div key={severity} className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <div className={config.textColor}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={cn('text-sm font-semibold', config.textColor)}>
                          {config.label}
                        </span>
                        <Badge variant="secondary" className="text-xs rounded-full h-5 px-2 min-w-5 justify-center">
                          {issues.length}
                        </Badge>
                      </div>
                      <div className="space-y-3 pl-2 sm:pl-3">
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
