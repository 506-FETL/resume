import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { TRACKER_SEARCH_INPUT_ID } from '../../../const'
import { useTrackerFilterActions } from '../../../hooks/use-tracker-filter-actions'
import useTrackerStore from '../../../store'

export function TrackerSearch({ isMobile }: { isMobile: boolean }) {
  const keyword = useTrackerStore((state) => state.searchKeyword)
  const local = useTrackerStore((state) => state.baseScopeComplete)
  const [draft, setDraft] = useState(keyword)
  const [composing, setComposing] = useState(false)
  const reduce = useReducedMotion()
  const { clearSearch } = useTrackerFilterActions()

  useEffect(() => {
    setDraft(keyword)
  }, [keyword])

  useEffect(() => {
    if (composing || draft === keyword) return
    if (local || !draft) {
      useTrackerStore.getState().setSearchKeyword(draft)

      return
    }

    const timer = setTimeout(
      () => useTrackerStore.getState().setSearchKeyword(draft),
      180,
    )

    return () => clearTimeout(timer)
  }, [composing, draft, keyword, local])

  return (
    <div className='relative min-w-0 flex-1'>
      <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
      <Input
        id={TRACKER_SEARCH_INPUT_ID}
        type='search'
        aria-label='搜索职位'
        value={draft}
        placeholder='搜索职位…'
        className={cn(
          'pl-9 pr-9 shadow-none [&::-webkit-search-cancel-button]:appearance-none',
          isMobile
            ? 'h-11 rounded-xl border-transparent bg-muted/50 dark:bg-muted/50'
            : 'rounded-lg',
        )}
        onChange={(event) => setDraft(event.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
      />
      <AnimatePresence initial={false}>
        {draft && (
          <PresenceDiv
            className={cn('absolute right-1', isMobile ? 'top-1.5' : 'top-0.5')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : DURATION.fast }}
          >
            <Button
              size='icon-sm'
              variant='ghost'
              aria-label='清空搜索'
              onClick={() => {
                setDraft('')
                clearSearch()
              }}
            >
              <X className='size-3.5' />
            </Button>
          </PresenceDiv>
        )}
      </AnimatePresence>
    </div>
  )
}
