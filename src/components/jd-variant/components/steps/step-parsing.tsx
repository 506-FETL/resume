import Markdown from 'react-markdown'
import { AutoScrollContainer } from '@/components/ui/auto-scroll-container'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
