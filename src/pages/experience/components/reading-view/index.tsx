import { AnimatePresence } from 'motion/react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { CONTENT_SWITCH } from '@/lib/motion'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import type { RefObject } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { getExperienceListSource } from '../../utils'
import { useExperiencePageStore } from '../../store'
import SourceDetail from '../source-detail'

export default function ReadingView({
  backRef,
}: {
  backRef: RefObject<HTMLButtonElement | null>
}) {
  const sourceId = useExperiencePageStore((state) => state.sourceId)
  const versionId = useExperiencePageStore((state) => state.versionId)
  const blockId = useExperiencePageStore((state) => state.blockId)
  const query = useExperiencePageStore((state) => state.query)
  const filter = useExperiencePageStore((state) => state.filter)
  const offset = useExperiencePageStore((state) => state.offset)
  const { closeDetail } = useExperiencePageStore.getState()

  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()

  const source = useExperienceSourcesStore((state) =>
    getExperienceListSource(state, { query, offset, filter }, sourceId),
  )

  function returnToLibrary() {
    closeDetail()

    if (
      location.search ||
      (location.state as { sourceId?: string } | null)?.sourceId
    )
      navigate('/experience', { replace: true, state: null })
  }

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-4'>
      <div className='shrink-0'>
        <Button
          ref={backRef}
          variant='ghost'
          size='sm'
          onClick={returnToLibrary}
        >
          <ArrowLeft />
          返回资料库
        </Button>
      </div>
      <div
        data-experience-reading-scroll
        className='min-h-0 flex-1 overflow-y-auto px-1'
      >
        <article className='mx-auto w-full max-w-[65ch] pb-6'>
          <AnimatePresence mode='wait' initial={false}>
            {sourceId && (
              <PresenceDiv
                key={`${sourceId}:${versionId ?? 'current'}:${blockId ?? ''}`}
                initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  transition: {
                    ...CONTENT_SWITCH.exit,
                    duration: reduced ? 0 : CONTENT_SWITCH.exit.duration,
                  },
                }}
                transition={{
                  ...CONTENT_SWITCH.enter,
                  duration: reduced ? 0 : CONTENT_SWITCH.enter.duration,
                }}
              >
                <SourceDetail
                  sourceId={sourceId}
                  versionId={versionId}
                  blockId={blockId}
                  listSource={source}
                />
              </PresenceDiv>
            )}
          </AnimatePresence>
        </article>
      </div>
    </div>
  )
}
