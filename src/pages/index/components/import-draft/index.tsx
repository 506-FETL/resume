import type { MouseEventHandler } from 'react'
import type { ImportDraft } from '@/lib/resume-preparation/types'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { DURATION, EASE } from '@/lib/motion'
import {
  getPreparationRevision,
  loadImportDraft,
  preparationScope,
  subscribePreparation,
} from '@/lib/resume-preparation/storage'
import useUserStore from '@/store/user'

export default function ImportDraftNotice({
  onResume,
}: {
  onResume: MouseEventHandler<HTMLButtonElement>
}) {
  const reduceMotion = useReducedMotion()
  const userId = useUserStore((state) => state.currentUser?.id ?? null)

  const revision = useSyncExternalStore(
    subscribePreparation,
    getPreparationRevision,
  )

  const [saved, setSaved] = useState<{
    scope: string
    draft: ImportDraft | null
  } | null>(null)

  const scope = preparationScope(userId)

  useEffect(() => {
    let active = true

    loadImportDraft(scope)
      .then((draft) => {
        if (active) setSaved({ scope, draft })
      })
      .catch(() => {
        if (active) setSaved(null)
      })

    return () => {
      active = false
    }
  }, [scope, revision])

  const visible = saved?.scope === scope && Boolean(saved.draft?.sourceText)

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <PresenceDiv
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            transition: { duration: reduceMotion ? 0 : DURATION.fast },
          }}
          transition={{
            duration: reduceMotion ? 0 : DURATION.base,
            ease: EASE.out,
          }}
          className='flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4'
        >
          <div className='min-w-0'>
            <p className='text-sm font-medium'>还有一份简历等待核对</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              导入草稿保存在本设备，可以接着上次继续。
            </p>
          </div>
          <Button variant='outline' size='sm' onClick={onResume}>
            继续核对
          </Button>
        </PresenceDiv>
      )}
    </AnimatePresence>
  )
}
