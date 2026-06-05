import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

export interface StepParsingProps {
  reasoning: string
  keywords: string[]
}

export function StepParsing({ reasoning, keywords }: StepParsingProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4 py-4 shadow-none">
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2">
            <Spinner />
            正在解析职位描述
          </CardTitle>
          <CardDescription>提取岗位职责、技能要求和核心关键词。</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          {reasoning
            ? (
                <ScrollArea className="h-32 rounded-md border bg-muted/30 p-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground" aria-live="polite">
                    {reasoning}
                  </p>
                </ScrollArea>
              )
            : (
                <div className="flex flex-col gap-2" aria-label="正在等待模型分析">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">已提取关键词</p>
        <div className="flex min-h-7 flex-wrap gap-2" aria-live="polite" aria-label="提取的关键词">
          {keywords.map(kw => <Badge key={kw} variant="outline">{kw}</Badge>)}
          {keywords.length === 0 && <span className="text-sm text-muted-foreground">关键词将在解析过程中显示。</span>}
        </div>
      </div>
    </div>
  )
}
