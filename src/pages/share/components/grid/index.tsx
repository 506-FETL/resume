import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { AnimatePresence } from 'motion/react'
import ShareCard from '../card'

interface ShareGridProps {
  shares: ResumeShareRecord[]
  onPreview: (share: ResumeShareRecord) => void
  onSettings: (share: ResumeShareRecord) => void
  onPushLatest: (share: ResumeShareRecord) => void
  onToggleActive: (share: ResumeShareRecord) => void
  onDelete: (share: ResumeShareRecord) => void
}

export default function ShareGrid({ shares, onPreview, onSettings, onPushLatest, onToggleActive, onDelete }: ShareGridProps) {
  return (
    <div className="hidden min-w-0 grid-cols-3 gap-3 lg:grid 2xl:grid-cols-4">
      <AnimatePresence initial={false} mode="popLayout">
        {shares.map((share, index) => (
          <ShareCard
            key={share.id}
            share={share}
            index={index}
            onPreview={() => onPreview(share)}
            onSettings={() => onSettings(share)}
            onPushLatest={() => onPushLatest(share)}
            onToggleActive={() => onToggleActive(share)}
            onDelete={() => onDelete(share)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
