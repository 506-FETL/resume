import type { VariantChange } from '../../types'
import { Sparkles } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { parseSanitizedHtml } from '@/lib/safe-html'
import { SECTION_LABEL } from '../../const'

export interface StepResultProps {
  matchRate: number | null
  changes: VariantChange[]
}

export function StepResult({ matchRate, changes }: StepResultProps) {
  const grouped = changes.reduce<Record<string, VariantChange[]>>((acc, c) => {
    (acc[c.section] ??= []).push(c)
    return acc
  }, {})
  const pct = matchRate == null ? '—' : `${Math.round(matchRate * 100)}%`

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Sparkles className="size-4" aria-hidden />
        <AlertTitle>派生完成</AlertTitle>
        <AlertDescription>
          关键词匹配度：
          <span className="font-semibold tabular-nums">{pct}</span>
        </AlertDescription>
      </Alert>

      <ScrollArea className="h-[min(44vh,24rem)] pr-3">
        <Accordion type="multiple" className="flex flex-col gap-2">
          {Object.entries(grouped).map(([section, items]) => (
            <AccordionItem key={section} value={section} className="rounded-lg border px-4">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  {SECTION_LABEL[section as keyof typeof SECTION_LABEL] ?? section}
                  <Badge variant="secondary">{items.length}</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="flex flex-col gap-3">
                  {items.map(change => (
                    <li key={`${change.itemId}-${change.fieldPath}`} className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-muted-foreground">{change.reason}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {change.matchedKeywords.map(keyword => (
                            <Badge key={keyword} variant="outline">{keyword}</Badge>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Card className="gap-3 py-3 shadow-none">
                          <CardHeader className="px-3">
                            <CardTitle>改写前</CardTitle>
                            <CardDescription>原简历中的内容</CardDescription>
                          </CardHeader>
                          <CardContent className="prose prose-sm max-w-none wrap-break-word px-3 leading-relaxed text-foreground">
                            {parseSanitizedHtml(String(change.before ?? ''))}
                          </CardContent>
                        </Card>
                        <Card className="gap-3 border-primary/30 bg-primary/5 py-3 shadow-none">
                          <CardHeader className="px-3">
                            <CardTitle>改写后</CardTitle>
                            <CardDescription>针对当前 JD 优化后的内容</CardDescription>
                          </CardHeader>
                          <CardContent className="prose prose-sm max-w-none wrap-break-word px-3 leading-relaxed text-foreground">
                            {parseSanitizedHtml(String(change.after ?? ''))}
                          </CardContent>
                        </Card>
                      </div>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </div>
  )
}
