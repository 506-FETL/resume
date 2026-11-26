import { AnimatePresence } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { useExperiencePageStore } from '../../store'
import type { ExperienceSourceTarget } from '../../types'

export default function LibrarySelection({
  sources,
  disabled,
}: {
  sources: ExperienceSourceTarget[]
  disabled: boolean
}) {
  const selectionMode = useExperiencePageStore((state) => state.selectionMode)

  const selectedSources = useExperiencePageStore(
    (state) => state.selectedSources,
  )

  const deleting = useExperiencePageStore((state) => state.deleting)

  const { togglePage, clearSelection, requestDelete } =
    useExperiencePageStore.getState()

  const reduced = useReducedMotion()
  const selectedIds = new Set(selectedSources.map((source) => source.id))

  const selectedOnPage = sources.filter((source) =>
    selectedIds.has(source.id),
  ).length

  const checked =
    sources.length > 0 && selectedOnPage === sources.length
      ? true
      : selectedOnPage > 0
        ? 'indeterminate'
        : false

  return (
    <AnimatePresence initial={false}>
      {selectionMode && (
        <PresenceDiv
          className='shrink-0 overflow-hidden'
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduced ? 0 : DURATION.fast, ease: EASE.out }}
        >
          <div className='pt-3'>
            <div className='flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-muted/60 px-3 py-2 text-sm'>
              <label className='flex min-h-9 cursor-pointer items-center gap-2.5'>
                <Checkbox
                  checked={checked}
                  disabled={disabled || deleting || !sources.length}
                  onCheckedChange={() => togglePage(sources)}
                />
                全选本页
              </label>
              <p aria-live='polite' className='text-muted-foreground'>
                已选 {selectedSources.length} 份
              </p>
              <div className='ml-auto flex items-center gap-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  disabled={deleting || !selectedSources.length}
                  onClick={clearSelection}
                >
                  清空
                </Button>
                <Button
                  variant='destructive'
                  size='sm'
                  disabled={deleting || !selectedSources.length}
                  onClick={() => requestDelete(selectedSources)}
                >
                  <Trash2 />
                  删除所选
                </Button>
              </div>
            </div>
          </div>
        </PresenceDiv>
      )}
    </AnimatePresence>
  )
}
