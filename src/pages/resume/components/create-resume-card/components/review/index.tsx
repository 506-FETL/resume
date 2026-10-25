import type { ORDERType, ResumeSchema } from '@/lib/schema'
import type { ReviewField, ReviewModule } from '../../types'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Plus, Trash2 } from 'lucide-react'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DURATION } from '@/lib/motion'
import { resumeHtmlToText, textToResumeHtml } from '@/lib/resume-import/text'
import { SECTION_LABELS } from '@/lib/resume-preparation/const'
import { cn } from '@/lib/utils'
import { REVIEW_MODULES } from '../../const'
import { useCreationDraftStore } from '../../store'
import { populatedSections } from '../../utils'

function blankRow(module: ReviewModule) {
  return Object.fromEntries([
    ['entryId', crypto.randomUUID()],
    ['hidden', false],
    ...module.fields.map((field) => [
      field.key,
      field.kind === 'duration'
        ? ['', '']
        : field.kind === 'select'
          ? '不填'
          : '',
    ]),
  ])
}

export default function ImportReview() {
  const reduceMotion = useReducedMotion()
  const sectionRef = useRef<HTMLFieldSetElement>(null)
  const draft = useCreationDraftStore((state) => state.draft)
  const patch = useCreationDraftStore((state) => state.patch)
  const [activeSection, setActiveSection] = useState<ORDERType>('basics')
  const [destination, setDestination] = useState<ORDERType>('self_evaluation')
  const content = draft.content

  if (!content) return null

  const active = REVIEW_MODULES.find((item) => item.section === activeSection)!
  const section = content[activeSection] as unknown as Record<string, unknown>

  const rows = active.arrayKey
    ? (section[active.arrayKey] as Record<string, unknown>[])
    : [section]

  const populated = populatedSections(content)
  const locked = Boolean(draft.creation)

  function replaceContent(next: ResumeSchema, changed: ORDERType[]) {
    patch({
      content: next,
      reviewedSections: draft.reviewedSections.filter(
        (key) => !changed.includes(key),
      ),
    })
  }

  function updateRow(index: number, key: string, value: unknown) {
    const next = structuredClone(content!)
    const target = next[activeSection] as unknown as Record<string, unknown>

    if (active.arrayKey)
      (target[active.arrayKey] as Record<string, unknown>[])[index][key] = value
    else target[key] = value

    replaceContent(next, [activeSection])
  }

  function moveRow(index: number, targetSection: ORDERType) {
    const targetModule = REVIEW_MODULES.find(
      (module) => module.section === targetSection,
    )!

    const next = structuredClone(content!)
    const original = rows[index]
    const converted = blankRow(targetModule)

    active.fields.forEach((field, fieldIndex) => {
      const target =
        targetModule.fields.find(
          (item) => item.kind === 'rich' && field.kind === 'rich',
        ) ??
        targetModule.fields.find(
          (item) => item.kind === 'duration' && field.kind === 'duration',
        ) ??
        (field.kind === undefined
          ? targetModule.fields.filter((item) => !item.kind)[fieldIndex]
          : undefined)

      if (target) converted[target.key] = original[field.key]
    })

    // 额外字段仍留在原文中；移动不改变用户的原始文本。
    const from = next[activeSection] as unknown as {
      items: Record<string, unknown>[]
    }

    const to = next[targetSection] as unknown as {
      items: Record<string, unknown>[]
    }

    from.items.splice(index, 1)
    to.items.push(converted)
    replaceContent(next, [activeSection, targetSection])
  }

  function assignUnmatched() {
    const next = structuredClone(content!)

    const targetModule = REVIEW_MODULES.find(
      (module) => module.section === destination,
    )!

    const target = next[destination] as unknown as Record<string, unknown>
    const field = targetModule.fields.find((item) => item.kind === 'rich')!
    const html = textToResumeHtml(draft.unassignedText)

    if (targetModule.arrayKey) {
      const row = blankRow(targetModule)

      row[field.key] = html

      const targetRows = target[targetModule.arrayKey] as Record<
        string,
        unknown
      >[]

      targetRows.push(row)
    } else target[field.key] = `${target[field.key] ?? ''}${html}`

    replaceContent(next, [destination])
    patch({ unassignedText: '', unassignedReviewed: false })
  }

  return (
    <div className='flex min-h-0 flex-col gap-4'>
      {draft.warnings.length > 0 && (
        <p className='text-xs text-muted-foreground'>
          {draft.warnings.join('；')}
        </p>
      )}
      <div className='grid min-h-0 gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]'>
        <Collapsible
          className='min-w-0 rounded-lg border p-3 md:sticky md:top-0 md:self-start'
          defaultOpen
        >
          <CollapsibleTrigger className='cursor-pointer text-sm font-medium'>
            原文 · {draft.sourceName}
          </CollapsibleTrigger>
          <CollapsibleContent
            style={reduceMotion ? { animationDuration: '0s' } : undefined}
          >
            <pre className='mt-3 max-h-44 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-6 text-muted-foreground md:max-h-96'>
              {draft.sourceText}
            </pre>
          </CollapsibleContent>
        </Collapsible>
        <div className='min-w-0 space-y-4'>
          <div className='flex flex-wrap gap-1.5' aria-label='核对模块'>
            {REVIEW_MODULES.map(({ section: key }) => (
              <Button
                variant={activeSection === key ? 'default' : 'secondary'}
                size='sm'
                key={key}
                type='button'
                aria-pressed={activeSection === key}
                onClick={(event) => {
                  event.currentTarget.focus()
                  setActiveSection(key)
                }}
                className={cn(
                  'text-xs transition-colors motion-reduce:transition-none',
                  activeSection === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 hover:bg-muted',
                )}
              >
                {SECTION_LABELS[key]}
                {draft.reviewedSections.includes(key)
                  ? ' ✓'
                  : populated.includes(key)
                    ? ' ·'
                    : ''}
              </Button>
            ))}
          </div>
          <AnimatedContent animationKey={activeSection}>
            <fieldset
              ref={sectionRef}
              tabIndex={-1}
              disabled={locked}
              className='space-y-3 outline-none'
            >
              <legend className='mb-3 font-medium'>
                {SECTION_LABELS[activeSection]}
              </legend>
              {rows.map((row, index) => (
                <div
                  key={String(row.entryId ?? activeSection)}
                  className={cn(
                    'space-y-3',
                    active.arrayKey && 'rounded-lg border p-3',
                  )}
                >
                  {active.arrayKey && (
                    <div className='flex items-center justify-between gap-2'>
                      <span className='text-xs text-muted-foreground'>
                        第 {index + 1} 条
                      </span>
                      <div className='flex items-center gap-1'>
                        {activeSection !== 'edu_background' && (
                          <Select
                            disabled={locked}
                            value=''
                            onValueChange={(value) =>
                              moveRow(index, value as ORDERType)
                            }
                          >
                            <SelectTrigger
                              aria-label={`移动第${index + 1}条到其他模块`}
                              size='sm'
                              className='max-w-28 text-xs'
                              style={{
                                transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s`,
                              }}
                            >
                              <SelectValue placeholder='移动到…' />
                            </SelectTrigger>
                            <SelectContent
                              position='popper'
                              style={{
                                animationDuration: `${reduceMotion ? 0 : DURATION.fast}s`,
                              }}
                              onCloseAutoFocus={(event) => {
                                event.preventDefault()
                                sectionRef.current?.focus()
                              }}
                            >
                              {REVIEW_MODULES.filter(
                                (module) =>
                                  module.arrayKey &&
                                  module.section !== activeSection &&
                                  module.section !== 'edu_background',
                              ).map((module) => (
                                <SelectItem
                                  key={module.section}
                                  value={module.section}
                                >
                                  {SECTION_LABELS[module.section]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          variant='ghost'
                          size='icon-sm'
                          aria-label={`删除第${index + 1}条`}
                          onClick={() => {
                            const next = structuredClone(content)

                            const target = next[activeSection] as unknown as {
                              items: unknown[]
                            }

                            target.items.splice(index, 1)
                            replaceContent(next, [activeSection])
                          }}
                        >
                          <Trash2 className='size-3.5' />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className='grid gap-3 sm:grid-cols-2'>
                    {active.fields.map((field) => (
                      <ReviewInput
                        key={field.key}
                        field={field}
                        disabled={locked}
                        value={row[field.key]}
                        onChange={(value) => updateRow(index, field.key, value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {active.arrayKey && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    const next = structuredClone(content)

                    const target = next[activeSection] as unknown as {
                      items: unknown[]
                    }

                    target.items.push(blankRow(active))
                    replaceContent(next, [activeSection])
                  }}
                >
                  <Plus className='size-3.5' />
                  添加一条
                </Button>
              )}
              <label className='flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm'>
                <Checkbox
                  checked={draft.reviewedSections.includes(activeSection)}
                  onCheckedChange={(checked) =>
                    patch({
                      reviewedSections:
                        checked === true
                          ? [...draft.reviewedSections, activeSection]
                          : draft.reviewedSections.filter(
                              (key) => key !== activeSection,
                            ),
                    })
                  }
                />
                已核对{SECTION_LABELS[activeSection]}
              </label>
            </fieldset>
          </AnimatedContent>
        </div>
      </div>
      {draft.unassignedText && (
        <fieldset disabled={locked} className='space-y-3 rounded-lg border p-3'>
          <legend className='px-1 text-sm font-medium'>还没归类的内容</legend>
          <Textarea
            aria-label='未归类内容'
            value={draft.unassignedText}
            onChange={(event) =>
              patch({
                unassignedText: event.target.value,
                unassignedReviewed: false,
              })
            }
            rows={4}
          />
          <div className='flex flex-wrap items-center gap-2'>
            <Select
              disabled={locked}
              value={destination}
              onValueChange={(value) => setDestination(value as ORDERType)}
            >
              <SelectTrigger
                aria-label='未归类内容放入模块'
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
                {REVIEW_MODULES.filter((module) =>
                  module.fields.some((field) => field.kind === 'rich'),
                ).map((module) => (
                  <SelectItem key={module.section} value={module.section}>
                    {SECTION_LABELS[module.section]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant='outline' size='sm' onClick={assignUnmatched}>
              加入这个模块
            </Button>
          </div>
          <label className='flex items-start gap-2 text-xs text-muted-foreground'>
            <Checkbox
              checked={draft.unassignedReviewed}
              onCheckedChange={(value) =>
                patch({ unassignedReviewed: value === true })
              }
            />
            仅保留在原文中，不放进简历正文
          </label>
        </fieldset>
      )}
      <p className='text-xs text-muted-foreground'>逐项核对后，再选择模板。</p>
    </div>
  )
}

function ReviewInput({
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
