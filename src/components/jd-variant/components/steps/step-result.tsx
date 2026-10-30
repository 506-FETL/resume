import type { VariantChange } from '../../types'
import { Check } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { parseSanitizedHtml } from '@/lib/safe-html'
import { SECTION_LABEL } from '../../const'

export interface StepResultProps {
  matchRate: number | null
  changes: VariantChange[]
}

export function StepResult({ matchRate, changes }: StepResultProps) {
  const reduceMotion = useReducedMotion()

  const grouped = changes.reduce<Record<string, VariantChange[]>>(
    (acc, change) => {
      ;(acc[change.section] ??= []).push(change)

      return acc
    },
    {},
  )

  const pct = matchRate == null ? '—' : `${Math.round(matchRate * 100)}%`

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-start justify-between gap-4 border-b pb-5'>
        <div className='flex min-w-0 items-start gap-3'>
          <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
            <Check className='size-4' aria-hidden />
          </span>
          <div className='space-y-1'>
            <h3 className='text-base font-semibold'>岗位版本已保存</h3>
            <p className='text-sm text-muted-foreground'>
              {changes.length > 0
                ? `共调整 ${changes.length} 处内容，可在下方核对。`
                : '本次没有改写内容，可打开新简历继续编辑。'}
            </p>
          </div>
        </div>
        <div className='space-y-1 sm:text-right'>
          <p className='text-xs text-muted-foreground'>关键词覆盖率</p>
          <p className='text-2xl font-semibold leading-none tracking-tight tabular-nums'>
            {pct}
          </p>
        </div>
        <p className='basis-full text-xs leading-relaxed text-muted-foreground'>
          按新简历相关模块中出现的岗位关键词占比计算。
        </p>
      </div>

      <Accordion type='multiple' defaultValue={Object.keys(grouped)}>
        {Object.entries(grouped).map(([section, items]) => (
          <AccordionItem key={section} value={section}>
            <AccordionTrigger className='items-center py-4'>
              <span className='flex min-w-0 items-center gap-2'>
                {SECTION_LABEL[section as keyof typeof SECTION_LABEL] ??
                  section}
                <span className='text-xs font-normal tabular-nums text-muted-foreground'>
                  {items.length} 处
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent
              style={{ animationDuration: reduceMotion ? '0s' : undefined }}
              className='pb-5'
            >
              <ul className='divide-y'>
                {items.map((change, index) => (
                  <li
                    key={`${change.itemId}-${change.fieldPath}`}
                    className='space-y-4 py-5 first:pt-0 last:pb-0'
                  >
                    <div className='flex items-start gap-2.5'>
                      <span className='mt-0.5 text-xs tabular-nums text-muted-foreground'>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className='min-w-0 flex-1 space-y-2'>
                        <p className='text-sm leading-relaxed wrap-anywhere text-muted-foreground'>
                          {change.reason}
                        </p>
                        {change.matchedKeywords.length > 0 && (
                          <div
                            className='flex flex-wrap gap-1.5'
                            aria-label='对应岗位关键词'
                          >
                            {change.matchedKeywords.map((keyword) => (
                              <Badge
                                key={keyword}
                                variant='outline'
                                className='max-w-full whitespace-normal wrap-anywhere'
                              >
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className='grid min-w-0 gap-5 md:grid-cols-2 md:gap-6'>
                      <section className='min-w-0 space-y-2'>
                        <h4 className='text-xs font-medium text-muted-foreground'>
                          改写前
                        </h4>
                        <div className='prose prose-sm dark:prose-invert max-w-none wrap-anywhere text-sm leading-relaxed text-muted-foreground [&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere'>
                          {parseSanitizedHtml(String(change.before ?? ''))}
                        </div>
                      </section>
                      <section className='min-w-0 space-y-2 border-l-2 border-primary/30 pl-4'>
                        <h4 className='text-xs font-medium text-primary'>
                          改写后
                        </h4>
                        <div className='prose prose-sm dark:prose-invert max-w-none wrap-anywhere text-sm leading-relaxed text-foreground [&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere'>
                          {parseSanitizedHtml(String(change.after ?? ''))}
                        </div>
                      </section>
                    </div>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
