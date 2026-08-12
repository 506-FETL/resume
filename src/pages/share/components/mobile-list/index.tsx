import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import ActionDrawer from './action-drawer'
import MobileItem from './mobile-item'

interface MobileListProps {
  shares: ResumeShareRecord[]
}

export default function MobileList({ shares }: MobileListProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedShare, setSelectedShare] = useState<ResumeShareRecord | null>(null)
  const [restoreFocusTo, setRestoreFocusTo] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!selectedShare)
      return

    const currentShare = shares.find(share => share.id === selectedShare.id)
    if (!currentShare) {
      setDrawerOpen(false)
      return
    }
    if (currentShare !== selectedShare)
      setSelectedShare(currentShare)
  }, [selectedShare, shares])

  const handleOpen = (share: ResumeShareRecord, trigger: HTMLElement) => {
    setSelectedShare(share)
    setRestoreFocusTo(trigger)
    setDrawerOpen(true)
  }

  return (
    <>
      <div className="grid min-w-0 grid-cols-1 gap-2 lg:hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {shares.map((share, index) => (
            <MobileItem
              key={share.id}
              share={share}
              index={index}
              onOpen={trigger => handleOpen(share, trigger)}
            />
          ))}
        </AnimatePresence>
      </div>
      <ActionDrawer
        open={drawerOpen}
        share={selectedShare}
        restoreFocusTo={restoreFocusTo}
        onOpenChange={setDrawerOpen}
      />
    </>
  )
}
