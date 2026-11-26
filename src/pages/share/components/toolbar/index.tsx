import type { ShareStatusFilter } from '../../utils'
import { ChevronDown, FileUser, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useId, useState } from 'react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ResumeCommand from '../resume-option-command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DURATION, EASE } from '@/lib/motion'
import { SHARE_SEARCH_INPUT_ID, SHARE_STATUS_FILTERS } from '../../const'
import { useShareFilterActions } from '../../hooks/use-share-filter-actions'
import useShareStore from '../../store'
import { useDebouncedValue } from '@/hooks/use-debounce'

export default function Toolbar() {
  const statusCounts = useShareStore((state) => state.statusCounts)
  const statsError = useShareStore((state) => state.statsError)
  const statsLoading = useShareStore((state) => state.statsLoading)
  const resumeFilterNames = useShareStore((state) => state.resumeFilterNames)
  const searchKeyword = useShareStore((state) => state.searchKeyword)
  const resumeFilters = useShareStore((state) => state.resumeFilters)
  const statusFilter = useShareStore((state) => state.statusFilter)

  const {
    reloadManagementStats,
    setPageKeyword,
    setSearchKeyword,
    setResumeFilters,
    setStatusFilter,
  } = useShareStore.getState()

  const { resetFilters, clearSearch } = useShareFilterActions()
  const [resumeOpen, setResumeOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const indicatorId = useId()

  const selectedLabel =
    resumeFilters.length === 0
      ? '全部简历'
      : resumeFilters.length === 1
        ? (resumeFilterNames[resumeFilters[0]] ?? '已选 1 项')
        : `已选 ${resumeFilters.length} 份简历`

  const [composing, setComposing] = useState(false)
  const settledKeyword = useDebouncedValue(searchKeyword, 200)

  useEffect(() => {
    if (!composing && settledKeyword === searchKeyword)
      setPageKeyword(settledKeyword)
  }, [composing, settledKeyword, searchKeyword, setPageKeyword])

  const hasFilter =
    Boolean(searchKeyword) || resumeFilters.length > 0 || statusFilter !== 'all'

  return (
    <div className='min-w-0 space-y-4 [@media(max-height:500px)]:space-y-2'>
      {statsError && (
        <div
          role='alert'
          className='flex items-center gap-2 text-sm text-muted-foreground'
        >
          分享统计暂时不可用
          <Button
            variant='outline'
            size='sm'
            disabled={statsLoading}
            onClick={() => reloadManagementStats()}
          >
            重试统计
          </Button>
        </div>
      )}
      <Tabs
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as ShareStatusFilter)}
      >
        <div className='overflow-x-auto border-b'>
          <TabsList
            aria-label='按分享状态筛选'
            variant='line'
            className='h-10! min-w-full justify-between gap-1 p-0 sm:justify-start sm:gap-6'
          >
            {SHARE_STATUS_FILTERS.map(({ value, label }) => {
              return (
                <TabsTrigger
                  key={value}
                  value={value}
                  className='relative h-10 flex-1 gap-1 rounded-none px-0 pb-3 pt-1 text-xs after:hidden sm:flex-none sm:gap-1.5 sm:text-sm'
                >
                  {label}
                  <span className='rounded-sm px-0.5 text-xs leading-4 tabular-nums text-muted-foreground sm:bg-muted sm:px-1.5 sm:py-0.5'>
                    {statusCounts?.[value] ?? '—'}
                  </span>
                  {statusFilter === value && (
                    <motion.span
                      layoutId={reduceMotion ? undefined : indicatorId}
                      className='absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground'
                      transition={{
                        duration: reduceMotion ? 0 : DURATION.base,
                        ease: EASE.out,
                      }}
                    />
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
      </Tabs>

      <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
        <div className='relative min-w-0 flex-1 sm:max-w-85'>
          <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            id={SHARE_SEARCH_INPUT_ID}
            aria-label='搜索分享链接'
            value={searchKeyword}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder='搜索分享名称…'
            className='h-9 rounded-md pl-9 pr-8 shadow-none'
          />
          <AnimatePresence initial={false}>
            {searchKeyword && (
              <PresenceDiv
                className='absolute right-0.5 top-0.5'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : DURATION.fast }}
              >
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label='清空搜索'
                  onClick={clearSearch}
                >
                  <X className='size-3.5' />
                </Button>
              </PresenceDiv>
            )}
          </AnimatePresence>
        </div>
        <Popover open={resumeOpen} onOpenChange={setResumeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant='outline'
              aria-label={`筛选简历：${selectedLabel}`}
              className='h-9 w-28 justify-start gap-1.5 rounded-md px-2 text-xs shadow-none sm:w-40 sm:px-3 sm:text-sm'
            >
              <FileUser className='size-4 text-muted-foreground' />
              <span className='min-w-0 flex-1 truncate text-left'>
                {selectedLabel}
              </span>
              <ChevronDown className='size-3.5 text-muted-foreground' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-64 p-0' align='start'>
            <ResumeCommand
              open={resumeOpen}
              selected={resumeFilters}
              onSelect={(resume) => {
                const next = resumeFilters.includes(resume.resume_id)
                  ? resumeFilters.filter((id) => id !== resume.resume_id)
                  : [...resumeFilters, resume.resume_id]

                setResumeFilters(next, resume)
              }}
            />
            {resumeFilters.length > 0 && (
              <div className='border-t p-1'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='w-full justify-start'
                  onClick={() => setResumeFilters([])}
                >
                  <X className='size-3.5' />
                  清空选择
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        <AnimatePresence initial={false}>
          {hasFilter && (
            <PresenceDiv
              className='basis-full sm:basis-auto [@media(max-height:500px)]:basis-auto'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : DURATION.fast }}
            >
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground [@media(max-height:500px)]:size-9 [@media(max-height:500px)]:p-0'
                aria-label='重置筛选'
                onClick={resetFilters}
              >
                <X className='size-3.5' aria-hidden />
                <span className='[@media(max-height:500px)]:sr-only'>
                  重置筛选
                </span>
              </Button>
            </PresenceDiv>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
