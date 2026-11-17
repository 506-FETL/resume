import { useState } from 'react'
import type { GuideController } from '../../types'
import GuideArrow from '../guide-arrow'
import GuidePopover from '../guide-popover'
import '../../style.css'

export default function GuidePresentation({
  guide,
}: {
  guide: GuideController
}) {
  const [popover, setPopover] = useState<HTMLDivElement | null>(null)

  return (
    <>
      <GuidePopover guide={guide} onElement={setPopover} />
      <GuideArrow
        target={guide.target}
        popover={popover}
        active={guide.active && guide.index === 0}
      />
    </>
  )
}
