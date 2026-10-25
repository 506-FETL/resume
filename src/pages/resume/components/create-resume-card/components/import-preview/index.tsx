import { useState } from 'react'
import { ChevronDown, Pencil, Check } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { resumeHtmlToText } from '@/lib/resume-import/text'
import { hasResumeContent } from '@/lib/resume-import/mapping'
import { SECTION_LABELS } from '@/lib/resume-preparation/const'
import { useCreationDraftStore } from '../../store'
import { populatedSections } from '../../utils'
import { REVIEW_MODULES } from '../../const'
import ImportReview from '../review'

export default function ImportPreview() {
  const draft = useCreationDraftStore((state) => state.draft)
  const [editing, setEditing] = useState(false)
  const reduceMotion = useReducedMotion()
  const content = draft.content

  if (!content) return null

  const sections = populatedSections(content)
  const filled = hasResumeContent(content)

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium'>
            {filled ? '内容已填入，可以选择模板了' : '尚未识别到可填充的内容'}
          </p>
          <p className='mt-1 break-words text-xs text-muted-foreground'>
            {draft.sourceName}
            {filled
              ? ' · 创建后仍可继续编辑'
              : ' · 可返回换一个文件，或展开修改内容'}
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setEditing(!editing)}
        >
          {editing ? (
            <Check className='size-3.5' />
          ) : (
            <Pencil className='size-3.5' />
          )}
          {editing ? '完成修改' : '修改内容'}
        </Button>
      </div>
      {draft.warnings.length > 0 && (
        <p className='text-xs leading-5 text-muted-foreground'>
          {draft.warnings.join(' ')}
        </p>
      )}
      {draft.unassignedText && (
        <Collapsible className='rounded-lg border bg-muted/20 px-3 py-2.5'>
          <CollapsibleTrigger className='flex w-full cursor-pointer items-center justify-between gap-3 text-left text-xs'>
            <span>
              有 {draft.unassignedText.split('\n').filter(Boolean).length}{' '}
              行尚未填入，已保留在原文中，可稍后补充。
            </span>
            <ChevronDown className='size-3.5 shrink-0' />
          </CollapsibleTrigger>
          <CollapsibleContent
            style={reduceMotion ? { animationDuration: '0s' } : undefined}
          >
            <pre className='mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-6 text-muted-foreground'>
              {draft.unassignedText}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
      <AnimatedContent animationKey={editing ? 'editing' : 'preview'}>
        {editing ? (
          <ImportReview />
        ) : (
          <article
            aria-label='已填充的简历内容'
            className='space-y-6 rounded-lg border bg-background p-5 sm:p-7'
          >
            <header className='space-y-2'>
              <h3 className='text-xl font-semibold'>
                {content.basics.name || '姓名待补充'}
              </h3>
              <p className='break-words text-sm text-muted-foreground'>
                {[content.basics.phone, content.basics.email]
                  .filter(Boolean)
                  .join(' · ') || '联系方式待补充'}
              </p>
            </header>
            {REVIEW_MODULES.filter(
              (module) =>
                module.section !== 'basics' &&
                sections.includes(module.section),
            ).map((module) => {
              const section = content[module.section] as unknown as Record<
                string,
                unknown
              >

              const rows = module.arrayKey
                ? (section[module.arrayKey] as Record<string, unknown>[])
                : [section]

              return (
                <section key={module.section} className='space-y-3'>
                  <h4 className='border-b pb-2 text-sm font-semibold'>
                    {SECTION_LABELS[module.section]}
                    {module.arrayKey && (
                      <span className='ml-2 font-normal text-muted-foreground'>
                        {rows.length} 条
                      </span>
                    )}
                  </h4>
                  {rows.map((row, index) => (
                    <div
                      key={String(row.entryId ?? index)}
                      className='space-y-1.5'
                    >
                      {module.fields.map((field) => {
                        const value = row[field.key]

                        const text = Array.isArray(value)
                          ? value.filter(Boolean).join(' — ')
                          : resumeHtmlToText(String(value ?? ''))

                        if (!text || text === '不填') return null

                        return (
                          <p
                            key={field.key}
                            className={
                              field.kind === 'rich'
                                ? 'whitespace-pre-wrap break-words text-sm leading-6'
                                : 'break-words text-sm text-muted-foreground'
                            }
                          >
                            {text}
                          </p>
                        )
                      })}
                    </div>
                  ))}
                </section>
              )
            })}
          </article>
        )}
      </AnimatedContent>
      {!editing && (
        <Collapsible>
          <CollapsibleTrigger className='flex cursor-pointer items-center gap-1 text-xs text-muted-foreground'>
            查看完整原文
            <ChevronDown className='size-3.5' />
          </CollapsibleTrigger>
          <CollapsibleContent
            style={reduceMotion ? { animationDuration: '0s' } : undefined}
          >
            <pre className='mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-3 font-sans text-xs leading-6'>
              {draft.sourceText}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
