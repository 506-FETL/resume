import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface StepParsingProps {
  reasoning: string
  keywords: string[]
  onAbort: () => void
}

export function StepParsing({ reasoning, keywords, onAbort }: StepParsingProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {' '}
        正在解析 JD…
      </div>
      {reasoning && (
        <div
          className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {reasoning}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5" aria-live="polite" aria-label="提取的关键词">
        {keywords.map(kw => <Badge key={kw} variant="outline">{kw}</Badge>)}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={onAbort}>取消</Button>
      </div>
    </div>
  )
}
