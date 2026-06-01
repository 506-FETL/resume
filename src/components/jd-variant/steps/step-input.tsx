import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MIN_JD_CHARS } from '../const'

export interface RecentJd {
  snippet: string
  full: string
}

export interface StepInputProps {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  recentJds: RecentJd[]
}

const SAMPLE_JD = `职位：前端工程师
要求：3 年以上 React 经验，熟悉 TypeScript / Tailwind / 状态管理，能独立交付完整模块。`

export function StepInput({ value, onChange, onSubmit, recentJds }: StepInputProps) {
  const trimmedLen = value.trim().length
  const tooShort = trimmedLen < MIN_JD_CHARS
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="jd-input" className="text-sm font-medium">
        粘贴 JD（≥
        {' '}
        {MIN_JD_CHARS}
        {' '}
        字）
      </label>
      <Textarea
        id="jd-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={8}
        placeholder="请粘贴目标岗位 JD…"
        className="resize-none"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span aria-live="polite">
          {trimmedLen}
          {' '}
          字
          {tooShort ? `（还差 ${Math.max(0, MIN_JD_CHARS - trimmedLen)} 字）` : ''}
        </span>
        {recentJds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recentJds.slice(0, 3).map(jd => (
              <Button
                key={jd.snippet}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(jd.full)}
                aria-label={`复用 JD：${jd.snippet}`}
              >
                <Badge variant="secondary" className="font-normal">
                  复用：
                  {jd.snippet}
                </Badge>
              </Button>
            ))}
          </div>
        )}
      </div>
      <Accordion type="single" collapsible>
        <AccordionItem value="sample">
          <AccordionTrigger className="text-xs">查看示例 JD</AccordionTrigger>
          <AccordionContent>
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{SAMPLE_JD}</pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="flex justify-end">
        <Button type="button" disabled={tooShort} onClick={onSubmit}>开始派生</Button>
      </div>
    </div>
  )
}
