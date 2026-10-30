import type { VariantChange } from '../../types'
import { motion } from 'motion/react'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { SECTION_LABEL } from '../../const'
import { GenerationDetails } from '../generation-details'

export interface StepRewritingProps {
  completedSections: string[]
  changes: VariantChange[]
  reasoning: string
}

export function StepRewriting({
  completedSections,
  changes,
  reasoning,
}: StepRewritingProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex items-start gap-3' role='status'>
        <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted'>
          <Spinner />
        </span>
        <div className='min-w-0 space-y-1'>
          <h3 className='text-base font-semibold'>正在生成岗位版本</h3>
          <p className='text-sm leading-relaxed text-muted-foreground'>
            调整与岗位相关的表述，完成后保存为新简历。
          </p>
        </div>
      </div>

      <section className='space-y-3' aria-label='改写记录'>
        <div className='flex flex-wrap items-baseline justify-between gap-2'>
          <h4 className='text-sm font-medium'>改写记录</h4>
          <p
            className='text-xs tabular-nums text-muted-foreground'
            aria-live='polite'
          >
            {changes.length > 0
              ? `已收到 ${changes.length} 处改写，涉及 ${completedSections.length} 个模块`
              : '正在整理改写内容'}
          </p>
        </div>
        {changes.length > 0 && (
          <ul className='divide-y border-y'>
            {changes.map((change) => (
              <motion.li
                key={`${change.section}-${change.itemId}-${change.fieldPath}`}
                initial={{
                  opacity: 0,
                  transform: reduceMotion ? 'none' : 'translateY(8px)',
                }}
                animate={{ opacity: 1, transform: 'translateY(0px)' }}
                transition={{
                  duration: reduceMotion ? 0 : DURATION.base,
                  ease: EASE.out,
                }}
                className='space-y-2 py-4'
              >
                <p className='text-sm font-medium'>
                  {SECTION_LABEL[change.section] ?? change.section}
                </p>
                <p className='text-sm leading-relaxed wrap-anywhere text-muted-foreground'>
                  {change.reason}
                </p>
                {change.matchedKeywords.length > 0 && (
                  <div className='flex flex-wrap gap-1.5'>
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
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <GenerationDetails reasoning={reasoning} />
    </div>
  )
}
