import { BrainCircuit, Layers3, Sparkles } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SCORE_LABELS } from '../../const'
import useAtsStore from '../../store'

export default function AssessmentBasisCard() {
  const { currentAtsConfig } = useAtsStore()
  const assessment = currentAtsConfig?.meta?.assessment

  if (!assessment || currentAtsConfig?.meta?.rubricVersion !== '2.0')
    return null

  const scoreRationales = Object.entries(currentAtsConfig.scores ?? {})
    .filter(([, score]) => score.rationale)

  return (
    <Card className="min-w-0 gap-0 overflow-hidden border-primary/10 py-0 shadow-sm">
      <CardHeader className="p-4 pb-2 md:p-5 md:pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BrainCircuit className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base md:text-lg">各维度判断理由</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">每一项都基于当前简历里的真实内容判断</p>
            </div>
          </div>
          <Badge variant="secondary" className="rounded-full text-xs">内容自适应评分 2.0</Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        <Accordion type="single" collapsible className="grid items-start gap-2 px-4 pb-4 md:grid-cols-2 md:px-5 md:pb-5">
          {scoreRationales.map(([key, score], index) => (
            <AccordionItem
              key={key}
              value={key}
              className={cn(
                'rounded-xl border border-transparent bg-muted/25 px-3 transition-[background-color,border-color] duration-200 last:border-b hover:border-primary/15 hover:bg-muted/40 data-[state=open]:border-primary/20 data-[state=open]:bg-primary/4 md:px-4',
                index === scoreRationales.length - 1 && scoreRationales.length % 2 === 1 && 'md:col-span-2',
              )}
            >
              <AccordionTrigger className="min-h-14 items-center py-3 hover:no-underline">
                <span className="flex min-w-0 flex-1 items-center gap-3 pr-1">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-[10px] font-semibold tabular-nums text-muted-foreground shadow-xs">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {SCORE_LABELS[key as keyof typeof SCORE_LABELS] ?? key}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-0.5 tabular-nums">
                    <span className="text-lg font-semibold tracking-tight text-foreground">{score.score}</span>
                    <span className="text-xs text-muted-foreground">
                      /
                      {score.max}
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="border-t border-border/50 pt-3 pr-8 text-sm leading-6 text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="mt-1 size-3.5 shrink-0 text-primary" />
                  <p>{score.rationale}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="space-y-4 border-t border-border/60 bg-muted/10 p-4 md:p-5">
          <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex shrink-0 items-center gap-2 pt-1 text-xs font-medium text-muted-foreground">
              <Layers3 className="size-3.5" />
              参与评估
            </div>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {assessment.evaluatedSections.map(section => (
                <Badge key={section} variant="outline" className="rounded-full bg-background/80 px-2.5 font-normal">
                  {section}
                </Badge>
              ))}
            </div>
          </div>

          {assessment.evidenceSignals.length > 0 && (
            <div className="min-w-0 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5" />
                关键证据信号
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                {assessment.evidenceSignals.map((signal, index) => (
                  <div key={signal} className="flex min-w-0 items-start gap-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2.5">
                    <span className="mt-0.5 text-[10px] font-semibold tabular-nums text-primary/70">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="wrap-break-word min-w-0 text-sm leading-6">{signal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
