import type { ShareStatusFilter } from '../../utils'
import { Check, ChevronDown, FileUser, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useId, useMemo, useState } from 'react'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { SHARE_SEARCH_INPUT_ID, SHARE_STATUS_FILTERS } from '../../const'
import { useShareFilterActions } from '../../hooks/use-share-filter-actions'
import useShareStore from '../../store'
import { deriveShareStatus, filterShares } from '../../utils'

export default function Toolbar() {
  const {
    allShares,
    pageLoading,
    pageError,
    resumeMap,
    searchKeyword,
    resumeFilters,
    statusFilter,
    setSearchKeyword,
    setResumeFilters,
    setStatusFilter,
  } = useShareStore()

  const { resetFilters, clearSearch } = useShareFilterActions()
  const [resumeOpen, setResumeOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const indicatorId = useId()

  const resumes = useMemo(
    () =>
      Object.values(resumeMap).sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [resumeMap],
  )

  const selectedLabel =
    resumeFilters.length === 0
      ? '全部简历'
      : resumeFilters.length === 1
        ? (resumes.find((resume) => resume.resumeId === resumeFilters[0])
            ?.displayName ?? '已选 1 项')
        : `已选 ${resumeFilters.length} 份简历`

  const filteredShares = useMemo(
    () =>
      filterShares(allShares, {
        keyword: searchKeyword,
        resumeIds: resumeFilters,
        status: 'all',
      }),
    [allShares, searchKeyword, resumeFilters],
  )

  const hasFilter =
    Boolean(searchKeyword) || resumeFilters.length > 0 || statusFilter !== 'all'

  return (
    <div className='min-w-0 space-y-4'>
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
              const count =
                value === 'all'
                  ? filteredShares.length
                  : filteredShares.filter(
                      (share) => deriveShareStatus(share) === value,
                    ).length

              return (
                <TabsTrigger
                  key={value}
                  value={value}
                  className='relative h-10 flex-1 gap-1 rounded-none px-0 pb-3 pt-1 text-xs after:hidden sm:flex-none sm:gap-1.5 sm:text-sm'
                >
                  {label}
                  <span className='rounded-sm px-0.5 text-xs leading-4 tabular-nums text-muted-foreground sm:bg-muted sm:px-1.5 sm:py-0.5'>
                    {pageLoading || pageError ? '—' : count}
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
            <Command>
              <CommandInput placeholder='搜索简历' />
              <CommandList>
                <CommandEmpty>没有匹配的简历</CommandEmpty>
                <CommandGroup>
                  {resumes.map((resume) => (
                    <CommandItem
                      key={resume.resumeId}
                      value={`${resume.displayName} ${resume.resumeId}`}
                      onSelect={() =>
                        setResumeFilters(
                          resumeFilters.includes(resume.resumeId)
                            ? resumeFilters.filter(
                                (id) => id !== resume.resumeId,
                              )
                            : [...resumeFilters, resume.resumeId],
                        )
                      }
                    >
                      <span
                        className={cn(
                          'flex size-4 items-center justify-center rounded border',
                          resumeFilters.includes(resume.resumeId) &&
                            'border-primary bg-primary text-primary-foreground',
                        )}
                      >
                        <Check
                          className={cn(
                            'size-3',
                            !resumeFilters.includes(resume.resumeId) &&
                              'opacity-0',
                          )}
                        />
                      </span>
                      <span className='min-w-0 flex-1 truncate'>
                        {resume.displayName}
                      </span>
                      {resumeFilters.includes(resume.resumeId) && (
                        <span className='sr-only'>已选择</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
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
            </Command>
          </PopoverContent>
        </Popover>
        <AnimatePresence initial={false}>
          {hasFilter && (
            <PresenceDiv
              className='basis-full sm:basis-auto'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : DURATION.fast }}
            >
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground'
                onClick={resetFilters}
              >
                <X className='size-3.5' />
                重置筛选
              </Button>
            </PresenceDiv>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
