import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MIN_JD_CHARS } from '../../const'

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
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
        <div className="text-xs text-muted-foreground" aria-live="polite">
          {trimmedLen}
          {' '}
          字
          {tooShort ? `（还差 ${Math.max(0, MIN_JD_CHARS - trimmedLen)} 字）` : ''}
        </div>
      </div>

      {recentJds.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">最近使用</span>
          <div className="flex flex-wrap gap-2">
            {recentJds.slice(0, 3).map(jd => (
              <button
                key={jd.snippet}
                type="button"
                onClick={() => onChange(jd.full)}
                aria-label={`复用 JD：${jd.snippet}`}
                className="max-w-full truncate rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {jd.snippet}
              </button>
            ))}
          </div>
        </div>
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="sample" className="border-b-0">
          <AccordionTrigger className="py-2 text-xs">查看示例 JD</AccordionTrigger>
          <AccordionContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">{SAMPLE_JD}</pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end">
        <Button type="button" disabled={tooShort} onClick={onSubmit}>开始派生</Button>
      </div>
    </div>
  )
}
