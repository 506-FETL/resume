import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { AnimatePresence } from 'motion/react'
import LinkCard from '../card'

interface GridProps {
  shares: ResumeShareRecord[]
}

export default function Grid({ shares }: GridProps) {
  return (
    <div className="hidden min-w-0 grid-cols-3 gap-3 lg:grid 2xl:grid-cols-4">
      <AnimatePresence initial={false} mode="popLayout">
        {shares.map((share, index) => (
          <LinkCard
            key={share.id}
            share={share}
            index={index}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
