import { memo, type RefObject } from 'react'
import { AnimatePresence } from 'motion/react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { DURATION, EASE } from '@/lib/motion'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import type { ExperienceSource } from '@/lib/experience-sources/types'
import type { ExperienceView } from '../../types'
import SourceItem from '../source-item'

export const LibraryRows = memo(function LibraryRows({
  items,
  visitedSourcesRef,
  scrollRef,
  view,
  disabled,
}: {
  items: ExperienceSource[]
  visitedSourcesRef: RefObject<Set<string>>
  scrollRef: RefObject<HTMLDivElement | null>
  view: ExperienceView
  disabled: boolean
}) {
  const reduced = useReducedMotion()

  return (
    <AnimatePresence mode='popLayout'>
      {items.map((source, index) => (
        <PresenceDiv
          key={source.id}
          className='min-w-0'
          layout={reduced ? false : 'position'}
          initial={
            visitedSourcesRef.current.has(source.id) || index > 5
              ? false
              : { opacity: 0, y: reduced ? 0 : 8 }
          }
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            transition: {
              duration: reduced ? 0 : DURATION.fast,
              ease: EASE.in,
              delay: 0,
            },
          }}
          transition={{
            duration: reduced ? 0 : DURATION.base,
            ease: EASE.out,
            delay: reduced || index > 5 ? 0 : index * 0.03,
          }}
        >
          <SourceItem
            source={source}
            view={view}
            disabled={disabled}
            scrollRef={scrollRef}
          />
        </PresenceDiv>
      ))}
    </AnimatePresence>
  )
})
