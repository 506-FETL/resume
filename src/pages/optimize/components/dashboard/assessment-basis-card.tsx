import { BrainCircuit, FileCheck2, Layers3, Target } from 'lucide-react'
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
    <Card className="md:col-span-2 lg:col-span-4 overflow-hidden border-primary/15 shadow-sm">
      <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <BrainCircuit className="size-4" />
            </div>
            <CardTitle className="text-lg">本次评分依据</CardTitle>
          </div>
          <Badge variant="secondary" className="rounded-full">内容自适应评分 2.0</Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-xl border border-border/60 bg-background p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FileCheck2 className="size-3.5" />
                候选人画像
              </div>
              <p className="text-sm leading-6 text-foreground">{assessment.candidateProfile}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Target className="size-3.5" />
                推断方向
              </div>
              <p className="text-sm leading-6 text-foreground">{assessment.inferredTarget}</p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-sm leading-6 text-foreground">{assessment.basisSummary}</p>
          </div>

          <div className="space-y-2">
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
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">各维度判断理由</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {scoreRationales.map(([key, score]) => (
              <div key={key} className="rounded-xl border border-border/60 bg-muted/15 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {SCORE_LABELS[key as keyof typeof SCORE_LABELS] ?? key}
                  </p>
                  <Badge variant="secondary" className="shrink-0 rounded-full">
                    {score.score}
                    /
                    {score.max}
                  </Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{score.rationale}</p>
              </div>
            ))}
          </div>

          {assessment.evidenceSignals.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-background p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">关键证据信号</p>
              <ul className="space-y-2">
                {assessment.evidenceSignals.map(signal => (
                  <li key={signal} className="flex items-start gap-2 text-sm leading-6">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{signal}</span>
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
