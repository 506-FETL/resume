import { AnimatePresence, motion } from 'motion/react'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { GenerationDetails } from '../generation-details'

export interface StepParsingProps {
  reasoning: string
  keywords: string[]
}

export function StepParsing({ reasoning, keywords }: StepParsingProps) {
  const reduceMotion = useReducedMotion()
  const hasKeywords = keywords.length > 0

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex items-start gap-3' role='status'>
        <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted'>
          <Spinner />
        </span>
        <div className='min-w-0 space-y-1'>
          <h3 className='text-base font-semibold'>
            {hasKeywords ? '岗位解析完成，正在准备简历' : '正在解析职位描述'}
          </h3>
          <p className='text-sm leading-relaxed text-muted-foreground'>
            {hasKeywords
              ? '接下来会根据这些关键词调整简历表述。'
              : '正在识别岗位要求、技能和经验关键词。'}
          </p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {hasKeywords && (
          <motion.section
            initial={{
              opacity: 0,
              transform: reduceMotion ? 'none' : 'translateY(8px)',
            }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{
              opacity: 0,
              transition: { duration: reduceMotion ? 0 : DURATION.fast },
            }}
            transition={{
              duration: reduceMotion ? 0 : DURATION.base,
              ease: EASE.out,
            }}
            className='space-y-3'
            aria-label='已提取的岗位关键词'
          >
            <h4 className='text-sm font-medium'>
              岗位关键词 · {keywords.length}
            </h4>
            <div className='flex flex-wrap gap-2'>
              {keywords.map((keyword) => (
                <Badge
                  key={keyword}
                  variant='secondary'
                  className='max-w-full whitespace-normal wrap-anywhere'
                >
                  {keyword}
                </Badge>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <GenerationDetails reasoning={reasoning} />
    </div>
  )
}
