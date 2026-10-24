import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { AnimatePresence } from 'motion/react'
import { SHARE_GRID_CLASS } from '../../const'
import LinkCard from '../card'

interface GridProps {
  shares: ResumeShareRecord[]
}

export default function Grid({ shares }: GridProps) {
  return (
    <div role='list' aria-label='分享链接列表' className={SHARE_GRID_CLASS}>
      <AnimatePresence initial={false} mode='popLayout'>
        {shares.map((share, index) => (
          <LinkCard key={share.id} share={share} index={index} />
        ))}
      </AnimatePresence>
    </div>
  )
}
