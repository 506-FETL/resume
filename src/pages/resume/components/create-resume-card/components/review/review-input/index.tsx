import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { resumeHtmlToText, textToResumeHtml } from '@/lib/resume-import/text'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import type { ReviewField } from '../../../types'

export function ReviewInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ReviewField
  disabled: boolean
  value: unknown
  onChange: (value: unknown) => void
}) {
  const reduceMotion = useReducedMotion()
  const [text, setText] = useState(() => resumeHtmlToText(String(value ?? '')))
  const emittedRef = useRef(value)

  useEffect(() => {
    if (value !== emittedRef.current)
      setText(resumeHtmlToText(String(value ?? '')))

    emittedRef.current = value
  }, [value])

  const label = (
    <span className='text-xs text-muted-foreground'>{field.label}</span>
  )

  if (field.kind === 'duration') {
    const values = Array.isArray(value) ? value : ['', '']

    return (
      <div className='space-y-1.5 sm:col-span-2'>
        {label}
        <div className='flex gap-2'>
          {[0, 1].map((index) => (
            <Input
              key={index}
              aria-label={`${field.label}${index === 0 ? '开始' : '结束'}`}
              placeholder={index === 0 ? '如 2022-09' : '如 2026-06 或 至今'}
              value={String(values[index] ?? '')}
              onChange={(event) => {
                const next = [...values]

                next[index] = event.target.value
                onChange(next)
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <label
      className={cn('space-y-1.5', field.kind === 'rich' && 'sm:col-span-2')}
    >
      {label}
      {field.kind === 'rich' ? (
        <Textarea
          rows={4}
          value={text}
          onChange={(event) => {
            const html = textToResumeHtml(event.target.value)

            emittedRef.current = html
            setText(event.target.value)
            onChange(html)
          }}
        />
      ) : field.kind === 'select' ? (
        <Select
          disabled={disabled}
          value={String(value || '不填')}
          onValueChange={onChange}
        >
          <SelectTrigger
            aria-label={field.label}
            className='w-full'
            style={{
              transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s`,
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            position='popper'
            style={{
              animationDuration: `${reduceMotion ? 0 : DURATION.fast}s`,
            }}
          >
            {field.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  )
}
