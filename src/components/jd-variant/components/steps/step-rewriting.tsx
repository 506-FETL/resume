import type { VariantChange } from '../../types'
import Markdown from 'react-markdown'
import { AutoScrollContainer } from '@/components/ui/auto-scroll-container'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { SECTION_LABEL } from '../../const'

export interface StepRewritingProps {
  completedSections: string[]
  changes: VariantChange[]
  estimatedTotal: number
  reasoning: string
}

export function StepRewriting({ completedSections, changes, estimatedTotal, reasoning }: StepRewritingProps) {
  const total = Math.max(estimatedTotal, completedSections.length || 1)
  const pct = Math.min(100, Math.round((completedSections.length / total) * 100))

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4 py-4 shadow-none">
        <CardHeader className="px-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-2">
              <Spinner className="mt-0.5" />
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle>正在针对 JD 改写</CardTitle>
                <CardDescription>只调整可改写文案，事实字段保持不变。</CardDescription>
              </div>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {completedSections.length}
              {' '}
              /
              {' '}
              {total}
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4">
          <Progress value={pct} aria-label="改写进度" />
          {reasoning
            ? (
                <AutoScrollContainer
                  className="max-h-75 bg-muted p-3 rounded-md mt-2 overflow-x-auto"
                  dependency={reasoning}
                >
                  <div className="markdown-content text-xs text-muted-foreground [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-2 [&>li]:mb-1 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-2 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-medium [&>h3]:mb-1 [&>code]:bg-background [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-xs [&>pre]:bg-background [&>pre]:p-2 [&>pre]:rounded [&>pre]:overflow-x-auto [&>pre]:mb-2 [&>blockquote]:border-l-2 [&>blockquote]:border-muted-foreground/30 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:mb-2 [&>strong]:font-semibold [&>em]:italic">
                    <Markdown>{reasoning}</Markdown>
                  </div>
                </AutoScrollContainer>
              )
            : (
                <div className="flex flex-col gap-2" aria-label="正在等待改写过程">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">实时改写记录</p>
        <ScrollArea className="h-56 pr-3">
          <ul className="flex flex-col gap-2" aria-live="polite">
            {changes.map(change => (
              <li key={`${change.section}-${change.itemId}-${change.fieldPath}`}>
                <Card className="gap-3 py-3 shadow-none">
                  <CardHeader className="px-3">
                    <CardTitle>{SECTION_LABEL[change.section] ?? change.section}</CardTitle>
                    <CardDescription>{change.reason}</CardDescription>
                  </CardHeader>
                  {change.matchedKeywords.length > 0 && (
                    <CardContent className="flex flex-wrap gap-1.5 px-3">
                      {change.matchedKeywords.map(keyword => (
                        <Badge key={keyword} variant="outline">{keyword}</Badge>
                      ))}
                    </CardContent>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          {changes.length === 0 && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
