import type { VersionDialogSelection } from '../../types'
import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import type { ShareVersionSelection } from '@/lib/supabase/resume/share.types'
import { Check, ChevronsUpDown, Clock3, History, RefreshCw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/date'

interface VersionSelectorProps {
  value: VersionDialogSelection
  versions: ResumeHistoryVersionListItem[]
  loading: boolean
  error: string | null
  freezeCurrent?: boolean
  currentDisabled?: boolean
  historyDisabled?: boolean
  disabled?: boolean
  onChange: (value: ShareVersionSelection) => void
  onRetry: () => void
}

function getVersionLabel(version: ResumeHistoryVersionListItem) {
  return (
    version.version_name?.trim() ||
    version.milestone_name?.trim() ||
    '未命名版本'
  )
}

function getSelectedLabel(
  value: VersionDialogSelection,
  versions: ResumeHistoryVersionListItem[],
) {
  if (value.kind === 'current') return '当前版本'
  if (value.kind === 'deleted-history')
    return `V${value.versionNo} · ${value.versionLabel}`

  const version = versions.find((item) => item.id === value.versionId)

  return version
    ? `V${version.version_no} · ${getVersionLabel(version)}`
    : '所选历史版本'
}

export default function VersionSelector({
  value,
  versions,
  loading,
  error,
  disabled,
  currentDisabled,
  freezeCurrent,
  historyDisabled,
  onChange,
  onRetry,
}: VersionSelectorProps) {
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const popoverOpen = open && !disabled

  const selectedLabel = useMemo(
    () =>
      value.kind === 'current' && freezeCurrent
        ? '云端已保存的当前内容（生成后固定）'
        : getSelectedLabel(value, versions),
    [value, versions, freezeCurrent],
  )

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  return (
    <Popover modal open={popoverOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={popoverOpen}
          aria-label={`分享版本：${selectedLabel}`}
          disabled={disabled}
          className='w-full min-w-0 justify-between font-normal'
        >
          <span aria-hidden='true' className='grid min-w-0 flex-1 text-left'>
            <AnimatePresence initial={false}>
              <motion.span
                key={selectedLabel}
                className='col-start-1 row-start-1 truncate'
                initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: reduceMotion ? 0 : -4,
                  transition: {
                    duration: reduceMotion ? 0 : DURATION.fast,
                    ease: EASE.in,
                  },
                }}
                transition={{
                  duration: reduceMotion ? 0 : DURATION.base,
                  ease: EASE.out,
                }}
              >
                {selectedLabel}
              </motion.span>
            </AnimatePresence>
          </span>
          <span aria-hidden='true' className='grid size-4 shrink-0'>
            <AnimatePresence initial={false}>
              <motion.span
                key={loading ? 'loading' : 'ready'}
                className='col-start-1 row-start-1 inline-flex'
                initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: reduceMotion ? 1 : 0.9,
                  transition: {
                    duration: reduceMotion ? 0 : DURATION.fast,
                    ease: EASE.in,
                  },
                }}
                transition={{
                  duration: reduceMotion ? 0 : DURATION.fast,
                  ease: EASE.out,
                }}
              >
                {loading ? (
                  <Spinner />
                ) : (
                  <ChevronsUpDown className='opacity-50' />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        inert={!popoverOpen}
        className='w-(--radix-popover-trigger-width) p-0 data-[state=closed]:pointer-events-none'
        align='start'
        style={{
          animationDuration: `${(reduceMotion ? 0 : popoverOpen ? DURATION.base : DURATION.fast) * 1000}ms`,
          animationTimingFunction: `cubic-bezier(${(popoverOpen ? EASE.out : EASE.in).join(',')})`,
        }}
      >
        <Command>
          <CommandInput placeholder='搜索版本' />
          <CommandList className='max-h-72'>
            <CommandEmpty>没有匹配的版本</CommandEmpty>
            <CommandGroup heading='发布内容'>
              <CommandItem
                value='当前版本 current'
                disabled={currentDisabled}
                onSelect={() => {
                  onChange({ kind: 'current' })
                  setOpen(false)
                }}
              >
                <Clock3 className='size-4' />
                <div className='min-w-0 flex-1'>
                  <p className='truncate'>
                    {freezeCurrent ? '云端已保存的当前内容' : '当前版本'}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {freezeCurrent
                      ? '生成链接时固定，后续保存不会改变'
                      : '保存后自动同步到分享链接'}
                  </p>
                </div>
                <Check
                  className={cn(
                    'size-4',
                    value.kind === 'current' ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </CommandItem>

              {value.kind === 'deleted-history' && (
                <CommandItem
                  disabled
                  value={`V${value.versionNo} ${value.versionLabel} 原版本已删除`}
                >
                  <History className='size-4' />
                  <div className='min-w-0 flex-1'>
                    <p className='truncate'>
                      V{value.versionNo}
                      {' · '}
                      {value.versionLabel}
                    </p>
                    <p className='truncate text-xs text-destructive'>
                      原版本已删除
                    </p>
                  </div>
                  <Check className='size-4' />
                </CommandItem>
              )}

              {versions.map((version) => {
                const label = getVersionLabel(version)

                const selected =
                  value.kind === 'history' && value.versionId === version.id

                return (
                  <CommandItem
                    key={version.id}
                    disabled={historyDisabled}
                    value={`V${version.version_no} ${label} ${version.version_name ?? ''} ${version.milestone_name ?? ''}`}
                    onSelect={() => {
                      onChange({ kind: 'history', versionId: version.id })
                      setOpen(false)
                    }}
                  >
                    <History className='size-4' />
                    <div className='min-w-0 flex-1'>
                      <p className='truncate'>
                        V{version.version_no}
                        {' · '}
                        {label}
                      </p>
                      <p className='truncate text-xs text-muted-foreground'>
                        {formatDateTime(new Date(version.created_at).getTime())}
                      </p>
                    </div>
                    <Check
                      className={cn(
                        'size-4',
                        selected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
          <Collapsible open={Boolean(error)}>
            <CollapsibleContent
              inert={!error || !popoverOpen}
              aria-hidden={!error}
              style={{
                animationDuration: `${(reduceMotion ? 0 : error ? DURATION.base : DURATION.fast) * 1000}ms`,
                animationTimingFunction: `cubic-bezier(${(error ? EASE.out : EASE.in).join(',')})`,
              }}
            >
              <div className='flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-destructive'>
                <span className='min-w-0 truncate'>历史版本加载失败</span>
                <Button
                  type='button'
                  variant='ghost'
                  size='xs'
                  onClick={onRetry}
                >
                  <RefreshCw data-icon='inline-start' />
                  重试
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
