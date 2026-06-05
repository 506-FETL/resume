import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { MIN_JD_CHARS } from '../../const'

export interface RecentJd {
  snippet: string
  full: string
}

export interface StepInputProps {
  value: string
  onChange: (next: string) => void
  recentJds: RecentJd[]
}

const SAMPLE_JD = `职位：前端工程师
要求：3 年以上 React 经验，熟悉 TypeScript / Tailwind / 状态管理，能独立交付完整模块。`

export function StepInput({ value, onChange, recentJds }: StepInputProps) {
  const trimmedLen = value.trim().length
  const tooShort = trimmedLen < MIN_JD_CHARS
  const showError = trimmedLen > 0 && tooShort

  return (
    <FieldGroup>
      <Field data-invalid={showError || undefined}>
        <FieldLabel htmlFor="jd-input">粘贴职位描述</FieldLabel>
        <Textarea
          id="jd-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={8}
          placeholder="请粘贴目标岗位 JD…"
          className="resize-none"
          aria-invalid={showError}
        />
        <FieldDescription aria-live="polite">
          已输入
          {' '}
          {trimmedLen}
          {' '}
          字，至少需要
          {' '}
          {MIN_JD_CHARS}
          {' '}
          字。
        </FieldDescription>
        {showError && (
          <FieldError>
            还差
            {' '}
            {Math.max(0, MIN_JD_CHARS - trimmedLen)}
            {' '}
            字。
          </FieldError>
        )}
      </Field>

      {recentJds.length > 0 && (
        <Field>
          <FieldLabel>最近使用</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {recentJds.slice(0, 3).map(jd => (
              <Button
                key={jd.snippet}
                type="button"
                size="xs"
                variant="outline"
                onClick={() => onChange(jd.full)}
                aria-label={`复用 JD：${jd.snippet}`}
                className="max-w-full"
              >
                <span className="truncate">{jd.snippet}</span>
              </Button>
            ))}
          </div>
        </Field>
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="sample">
          <AccordionTrigger>查看示例 JD</AccordionTrigger>
          <AccordionContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">{SAMPLE_JD}</pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </FieldGroup>
  )
}
