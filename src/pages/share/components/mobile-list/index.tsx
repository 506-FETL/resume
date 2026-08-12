import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { AnimatePresence } from 'motion/react'
import ShareMobileItem from '../mobile-item'

interface ShareMobileListProps {
  shares: ResumeShareRecord[]
  onMore: (share: ResumeShareRecord, trigger: HTMLElement) => void
}

export default function ShareMobileList({ shares, onMore }: ShareMobileListProps) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 lg:hidden">
      <AnimatePresence initial={false} mode="popLayout">
        {shares.map((share, index) => (
          <ShareMobileItem
            key={share.id}
            share={share}
            index={index}
            onMore={trigger => onMore(share, trigger)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
