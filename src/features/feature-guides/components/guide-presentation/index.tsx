import { useLayoutEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import type { GuideController } from '../../types'
import GuideArrow from '../guide-arrow'
import GuidePopover from '../guide-popover'
import '../../style.css'

export default function GuidePresentation({
  guide,
}: {
  guide: GuideController
}) {
  return guide.suspended ? null : <Presentation guide={guide} />
}

function Presentation({ guide }: { guide: GuideController }) {
  const [popover, setPopover] = useState<HTMLDivElement | null>(null)

  const [arrowPhase, setArrowPhase] = useState<'drawing' | 'drawn' | 'away'>(
    'drawing',
  )

  useLayoutEffect(() => {
    if (!guide.active) setArrowPhase('drawing')
    else if (guide.index !== 0) setArrowPhase('away')
  }, [guide.active, guide.index])

  return (
    <>
      <AnimatePresence>
        {guide.active && (
          <GuidePopover
            guide={guide}
            reveal={guide.targetIndex !== 0 || arrowPhase !== 'drawing'}
            onElement={setPopover}
          />
        )}
      </AnimatePresence>
      {popover && (
        <GuideArrow
          target={guide.target}
          popover={popover}
          active={
            guide.active &&
            guide.index === 0 &&
            guide.targetIndex === 0 &&
            (arrowPhase !== 'away' || guide.presentedIndex === 0) &&
            popover.dataset.guideStep === '0'
          }
          onDrawn={() => setArrowPhase('drawn')}
        />
      )}
    </>
  )
}
