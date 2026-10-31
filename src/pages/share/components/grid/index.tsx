import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { FileText } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useMemo } from 'react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import {
  SHARE_GRID_CLASS,
  SHARE_GROUP_CLASS,
  SHARE_GROUP_HEADER_CLASS,
  SHARE_MOTION,
} from '../../const'
import useShareStore from '../../store'
import LinkCard from '../card'

interface GridProps {
  shares: ResumeShareRecord[]
}

export default function Grid({ shares }: GridProps) {
  const reduceMotion = useReducedMotion()
  const resumeMap = useShareStore((state) => state.resumeMap)

  const groups = useMemo(() => {
    const groupedShares = new Map<string, ResumeShareRecord[]>()

    for (const share of shares) {
      const group = groupedShares.get(share.resume_id)

      if (group) group.push(share)
      else groupedShares.set(share.resume_id, [share])
    }

    return Array.from(groupedShares, ([resumeId, links]) => ({
      resumeId,
      links,
      title:
        resumeMap[resumeId]?.displayName ||
        links[0].display_name ||
        '未命名简历',
    }))
  }, [resumeMap, shares])

  return (
    <div
      role='list'
      aria-label='按简历分组的分享链接'
      className={SHARE_GRID_CLASS}
    >
      <AnimatePresence initial={false} mode='popLayout'>
        {groups.map(({ resumeId, title, links }) => {
          const titleId = `share-resume-${resumeId}`

          return (
            <PresenceDiv
              key={resumeId}
              role='listitem'
              className='min-w-0'
              layout={reduceMotion ? false : 'position'}
              initial={reduceMotion ? false : SHARE_MOTION.page.initial}
              animate={SHARE_MOTION.page.animate}
              exit={{
                opacity: 0,
                y: reduceMotion ? 0 : -4,
                transition: {
                  duration: reduceMotion ? 0 : DURATION.fast,
                  delay: 0,
                  ease: EASE.in,
                },
              }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.base,
                ease: EASE.out,
                layout: reduceMotion ? { duration: 0 } : SPRING.layout,
              }}
            >
              <section aria-labelledby={titleId} className={SHARE_GROUP_CLASS}>
                <header className={SHARE_GROUP_HEADER_CLASS}>
                  <div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'>
                    <FileText className='size-5' aria-hidden />
                  </div>
                  <div className='min-w-0'>
                    <h2
                      id={titleId}
                      title={title}
                      className='line-clamp-2 text-xl leading-tight font-semibold tracking-tight wrap-anywhere sm:text-2xl'
                    >
                      {title}
                    </h2>
                    <p className='mt-1.5 text-xs leading-4 text-muted-foreground'>
                      <span className='font-medium tabular-nums'>
                        {links.length}
                      </span>{' '}
                      个分享链接
                    </p>
                  </div>
                </header>

                <div
                  role='list'
                  aria-label={`${title}的分享链接`}
                  className='@container/share-links min-w-0'
                >
                  <AnimatePresence initial={false} mode='popLayout'>
                    {links.map((share, index) => (
                      <LinkCard
                        key={share.id}
                        share={share}
                        index={index}
                        resumeTitle={title}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            </PresenceDiv>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
