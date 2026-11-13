import type { AiSkillActivity } from '@/lib/ai/types'
import { ArrowUpRight, BookOpen, CircleAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { memo } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import AnimatedContent from '@/components/motion/animated-content'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace'
import { getSkillDefinition } from '@/lib/ai/skills/catalog'
import { DURATION, EASE } from '@/lib/motion'

const SkillActivity = memo(function SkillActivity({
  activity,
  streaming = false,
}: {
  activity: AiSkillActivity
  streaming?: boolean
}) {
  const reducedMotion = useReducedMotion()
  const skill = getSkillDefinition(activity.skillId)
  const pending = activity.state === 'loading'
  const failed = activity.state === 'error'
  const title = `${pending ? '正在加载' : failed ? '未能加载' : '本次使用'} ${activity.displayName}`

  return (
    <motion.div
      initial={
        reducedMotion || !streaming
          ? false
          : { opacity: 0, transform: 'translateY(8px)' }
      }
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{
        duration: reducedMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
    >
      <Trace>
        <TraceCollapsible>
          <TraceCollapsibleTrigger className='py-1'>
            <AnimatedContent
              as='span'
              className='min-w-0'
              animationKey={activity.state}
            >
              <TraceLine
                status={pending ? 'running' : failed ? 'error' : undefined}
              >
                <TraceIcon>{failed ? <CircleAlert /> : <BookOpen />}</TraceIcon>
                <TraceTitle title={title}>{title}</TraceTitle>
                <TraceDescription className='text-xs'>
                  v{activity.version}
                </TraceDescription>
              </TraceLine>
            </AnimatedContent>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent className='space-y-2 text-sm'>
            <AnimatedContent animationKey={failed ? 'error' : 'none'}>
              {failed && <p className='text-destructive'>{activity.error}</p>}
            </AnimatedContent>
            {skill && (
              <>
                <p>{skill.description}</p>
                <Trace>
                  <a
                    href={skill.sourceUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <TraceLine>
                      <TraceTitle>
                        {skill.sourceLabel}
                        <span className='sr-only'>（在新标签页打开）</span>
                      </TraceTitle>
                      <TraceIcon>
                        <ArrowUpRight />
                      </TraceIcon>
                    </TraceLine>
                  </a>
                </Trace>
              </>
            )}
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
    </motion.div>
  )
})

export default SkillActivity
