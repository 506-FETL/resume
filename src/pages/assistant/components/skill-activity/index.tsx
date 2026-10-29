import type { AiSkillActivity } from '@/lib/ai/types'
import { BookOpen, CircleAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { memo } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import AnimatedContent from '@/components/motion/animated-content'
import { Spinner } from '@/components/ui/spinner'
import { getSkillDefinition } from '@/lib/ai/skills/catalog'
import { DURATION, EASE } from '@/lib/motion'

const SkillActivity = memo(function SkillActivity({
  activity,
  streaming = false,
}: {
  activity: AiSkillActivity
  streaming?: boolean
}) {
  const reduced = useReducedMotion()
  const skill = getSkillDefinition(activity.skillId)
  const pending = activity.state === 'loading'
  const failed = activity.state === 'error'
  const label = pending ? '正在加载' : failed ? '加载失败' : '本次使用'

  return (
    <motion.div
      initial={
        reduced || !streaming
          ? false
          : { opacity: 0, transform: 'translateY(8px)' }
      }
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: reduced ? 0 : DURATION.base, ease: EASE.out }}
      className='my-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5'
      aria-live='polite'
    >
      <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm'>
        <AnimatedContent
          animationKey={activity.state}
          as='span'
          className='flex shrink-0 items-center gap-2'
        >
          {pending ? (
            <Spinner className='size-4 shrink-0' />
          ) : failed ? (
            <CircleAlert className='size-4 shrink-0 text-destructive' />
          ) : (
            <BookOpen className='size-4 shrink-0 text-primary' />
          )}
          <span className='text-muted-foreground'>{label}</span>
        </AnimatedContent>
        <span className='min-w-0 font-medium break-words'>
          {activity.displayName}
        </span>
      </div>
      <AnimatedContent animationKey={failed ? 'error' : 'ready'}>
        {failed && (
          <p className='mt-1 text-xs break-words text-destructive'>
            {activity.error}
          </p>
        )}
      </AnimatedContent>
      {skill && (
        <a
          href={skill.sourceUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='mt-1 block text-xs text-muted-foreground underline-offset-4 hover:underline'
        >
          {skill.sourceLabel}
          {' · v'}
          {activity.version}
        </a>
      )}
    </motion.div>
  )
})

export default SkillActivity
