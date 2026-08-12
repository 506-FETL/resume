import type { VersionDialogSelection } from '../../types'
import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import type { ShareVersionSelection } from '@/lib/supabase/resume/share.types'
import { Check, ChevronsUpDown, Clock3, History, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/date'

interface VersionSelectorProps {
  value: VersionDialogSelection
  versions: ResumeHistoryVersionListItem[]
  loading: boolean
  error: string | null
  disabled?: boolean
  onChange: (value: ShareVersionSelection) => void
  onRetry: () => void
}

function getVersionLabel(version: ResumeHistoryVersionListItem) {
  return version.version_name?.trim()
    || version.milestone_name?.trim()
    || '未命名版本'
}

function getSelectedLabel(
  value: VersionDialogSelection,
  versions: ResumeHistoryVersionListItem[],
) {
  if (value.kind === 'current')
    return '当前版本'
  if (value.kind === 'deleted-history')
    return `V${value.versionNo} · ${value.versionLabel}`

  const version = versions.find(item => item.id === value.versionId)
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
  onChange,
  onRetry,
}: VersionSelectorProps) {
  const [open, setOpen] = useState(false)
  const selectedLabel = useMemo(
    () => getSelectedLabel(value, versions),
    [value, versions],
  )

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full min-w-0 justify-between font-normal"
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          {loading
            ? <Spinner data-icon="inline-end" />
            : <ChevronsUpDown data-icon="inline-end" className="opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索版本" />
          <CommandList className="max-h-72">
            <CommandEmpty>没有匹配的版本</CommandEmpty>
            <CommandGroup heading="发布内容">
              <CommandItem
                value="当前版本 current"
                onSelect={() => {
                  onChange({ kind: 'current' })
                  setOpen(false)
                }}
              >
                <Clock3 className="size-4" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">当前版本</p>
                  <p className="truncate text-xs text-muted-foreground">发布此刻内容，之后不会自动更新</p>
                </div>
                <Check className={cn('size-4', value.kind === 'current' ? 'opacity-100' : 'opacity-0')} />
              </CommandItem>

              {value.kind === 'deleted-history' && (
                <CommandItem
                  disabled
                  value={`V${value.versionNo} ${value.versionLabel} 原版本已删除`}
                >
                  <History className="size-4" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      V
                      {value.versionNo}
                      {' · '}
                      {value.versionLabel}
                    </p>
                    <p className="truncate text-xs text-destructive">原版本已删除</p>
                  </div>
                  <Check className="size-4" />
                </CommandItem>
              )}

              {versions.map((version) => {
                const label = getVersionLabel(version)
                const selected = value.kind === 'history' && value.versionId === version.id
                return (
                  <CommandItem
                    key={version.id}
                    value={`V${version.version_no} ${label} ${version.version_name ?? ''} ${version.milestone_name ?? ''}`}
                    onSelect={() => {
                      onChange({ kind: 'history', versionId: version.id })
                      setOpen(false)
                    }}
                  >
                    <History className="size-4" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        V
                        {version.version_no}
                        {' · '}
                        {label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDateTime(new Date(version.created_at).getTime())}
                      </p>
                    </div>
                    <Check className={cn('size-4', selected ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
          {error && (
            <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-destructive">
              <span className="min-w-0 truncate">历史版本加载失败</span>
              <Button type="button" variant="ghost" size="xs" onClick={onRetry}>
                <RefreshCw data-icon="inline-start" />
                重试
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
