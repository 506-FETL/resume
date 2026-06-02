import type { VariantChange } from '../../types'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { SECTION_LABEL } from '../../const'

export interface StepRewritingProps {
  completedSections: string[]
  changes: VariantChange[]
  estimatedTotal: number
  reasoning: string
  onAbort: () => void
}

export function StepRewriting({ completedSections, changes, estimatedTotal, reasoning, onAbort }: StepRewritingProps) {
  const total = Math.max(estimatedTotal, completedSections.length || 1)
  const pct = Math.min(100, Math.round((completedSections.length / total) * 100))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {' '}
          正在改写…
        </span>
        <span className="tabular-nums text-xs text-muted-foreground">
          {completedSections.length}
          {' '}
          /
          {' '}
          {total}
        </span>
      </div>
      <Progress value={pct} aria-label="改写进度" />
      {reasoning && (
        <div
          className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {reasoning}
        </div>
      )}
      <ul className="flex max-h-60 flex-col gap-2 overflow-auto" aria-live="polite">
        {changes.map((c, i) => (
          <li key={`${c.section}-${c.itemId}-${i}`} className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{SECTION_LABEL[c.section] ?? c.section}</Badge>
              <span className="text-muted-foreground">{c.reason}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {c.matchedKeywords.map(kw => <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>)}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={onAbort}>取消</Button>
      </div>
    </div>
  )
}
