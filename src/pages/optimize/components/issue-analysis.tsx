import type { Issue } from '../types'
import { ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { SeverityBadge } from './severity-badge'

interface IssueAnalysisProps {
  issues: Issue[]
}

export function IssueAnalysis({ issues }: IssueAnalysisProps) {
  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          简历问题深度分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 pt-0">
        {issues.map(issue => (
          <Collapsible key={issue.id} className="border rounded-md">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 sm:p-4 hover:bg-muted/50">
              <div className="flex items-center gap-2 sm:gap-3 text-left">
                <SeverityBadge severity={issue.severity} />
                <span className="font-medium text-xs sm:text-sm">{issue.title}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 text-sm space-y-3 bg-muted/10">
                <Separator />
                <div className="grid gap-2">
                  <div>
                    <span className="font-semibold text-muted-foreground">问题描述: </span>
                    {issue.description}
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">ATS 影响: </span>
                    <span className="text-destructive/80">{issue.impact}</span>
                  </div>
                  <div className="pt-2">
                    <Button size="sm" variant="secondary" className="h-8 text-xs">查看详情 & 修复建议</Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  )
}
