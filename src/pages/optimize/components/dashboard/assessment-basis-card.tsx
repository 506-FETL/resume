import { BrainCircuit, Layers3 } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <Card className="min-w-0 overflow-hidden border-primary/10 shadow-sm">
      <CardHeader className="border-b border-border/60 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <BrainCircuit className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base md:text-lg">各维度判断理由</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">点击维度查看完整说明</p>
            </div>
          </div>
          <Badge variant="secondary" className="rounded-full">内容自适应评分 2.0</Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Accordion type="single" collapsible className="px-4 md:px-5">
          {scoreRationales.map(([key, score]) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="min-h-11 py-3 hover:no-underline">
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-1">
                  <span className="truncate">
                    {SCORE_LABELS[key as keyof typeof SCORE_LABELS] ?? key}
                  </span>
                  <Badge variant="secondary" className="shrink-0 rounded-full">
                    {score.score}
                    /
                    {score.max}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pr-8 text-sm leading-6 text-muted-foreground">
                {score.rationale}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="grid gap-4 border-t border-border/60 p-4 md:p-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Layers3 className="size-3.5" />
              实际参与评估的内容
            </div>
            <div className="flex flex-wrap gap-2">
              {assessment.evaluatedSections.map(section => (
                <Badge key={section} variant="outline" className="rounded-full bg-background">
                  {section}
                </Badge>
              ))}
            </div>
          </div>

          {assessment.evidenceSignals.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium text-muted-foreground">关键证据信号</p>
              <ul className="space-y-1.5">
                {assessment.evidenceSignals.map(signal => (
                  <li key={signal} className="flex min-w-0 items-start gap-2 text-sm leading-6">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="wrap-break-word min-w-0">{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
