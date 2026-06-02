import type { VariantChange } from '../../types'
import { Sparkles } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { parseSanitizedHtml } from '@/lib/safe-html'
import { SECTION_LABEL } from '../../const'

export interface StepResultProps {
  matchRate: number | null
  changes: VariantChange[]
  onOpen: () => void
  onDiscard: () => void
}

export function StepResult({ matchRate, changes, onOpen, onDiscard }: StepResultProps) {
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
      <Accordion type="multiple" className="max-h-72 space-y-2 overflow-auto">
        {Object.entries(grouped).map(([section, items]) => (
          <AccordionItem key={section} value={section} className="rounded-lg border px-3">
            <AccordionTrigger className="py-3 text-sm">
              {SECTION_LABEL[section as keyof typeof SECTION_LABEL] ?? section}
              {' '}
              <Badge variant="secondary" className="ml-2">{items.length}</Badge>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="flex flex-col gap-2 text-xs">
                {items.map((c, i) => (
                  <li key={`${c.itemId}-${i}`} className="space-y-2 rounded-md bg-muted/40 p-3">
                    <div className="text-muted-foreground">{c.reason}</div>
                    <div className="flex flex-wrap gap-1">
                      {c.matchedKeywords.map(kw => <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>)}
                    </div>
                    <details className="group">
                      <summary className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-foreground">对比 before / after</summary>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Before</span>
                          <div className="prose prose-sm max-w-none wrap-break-word rounded-md border bg-background p-2 leading-relaxed text-foreground">
                            {parseSanitizedHtml(String(c.before ?? ''))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-primary">After</span>
                          <div className="prose prose-sm max-w-none wrap-break-word rounded-md border border-primary/40 bg-primary/5 p-2 leading-relaxed text-foreground">
                            {parseSanitizedHtml(String(c.after ?? ''))}
                          </div>
                        </div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDiscard}>丢弃</Button>
        <Button type="button" onClick={onOpen}>打开新简历</Button>
      </div>
    </div>
  )
}
