import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { CONTENT_SWITCH } from '@/lib/motion'
import { useExperiencePageStore } from '../../store'
import { useExperienceNavigation } from '../../hooks/use-experience-navigation'
import ExperienceLibrary from '../library'
import ReadingView from '../reading-view'

export default function ExperienceWorkspace() {
  const navigation = useExperienceNavigation()
  const detailOpen = useExperiencePageStore((state) => state.detailOpen)

  const visitedLibraryRef = useRef(!detailOpen)

  useEffect(() => {
    if (!detailOpen) visitedLibraryRef.current = true
  }, [detailOpen])

  const transition = {
    ...(navigation.exiting ? CONTENT_SWITCH.exit : CONTENT_SWITCH.enter),
    ...(navigation.reduced && { duration: 0 }),
  }

  return (
    <div
      ref={navigation.hostRef}
      tabIndex={-1}
      className='relative flex min-h-0 min-w-0 flex-1 flex-col outline-none'
    >
      <motion.div
        ref={navigation.libraryRef}
        style={{ display: navigation.displayed ? 'none' : 'flex' }}
        initial={false}
        animate={{
          opacity: navigation.exiting ? 0 : 1,
          x: navigation.exiting && !navigation.reduced ? -8 : 0,
        }}
        transition={transition}
        onAnimationComplete={navigation.finishExit}
        className='min-h-0 min-w-0 flex-1 flex-col'
      >
        {(!detailOpen || visitedLibraryRef.current) && (
          <ExperienceLibrary scrollRef={navigation.scrollRef} />
        )}
      </motion.div>
      <motion.div
        ref={navigation.detailRef}
        style={{ display: navigation.displayed ? 'flex' : 'none' }}
        initial={false}
        animate={{
          opacity: navigation.exiting ? 0 : 1,
          x: navigation.exiting && !navigation.reduced ? 8 : 0,
        }}
        transition={transition}
        onAnimationComplete={navigation.finishExit}
        className='min-h-0 min-w-0 flex-1 flex-col'
      >
        {(navigation.displayed || detailOpen) && (
          <ReadingView backRef={navigation.backRef} />
        )}
      </motion.div>
    </div>
  )
}
