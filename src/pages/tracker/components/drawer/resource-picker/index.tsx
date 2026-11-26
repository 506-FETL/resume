import { useState, type ReactNode } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import {
  Command,
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
import { Button } from '@/components/ui/button'
import { useOptionPage } from '@/pages/share/hooks/use-option-page'
import {
  OptionPagination,
  OptionResults,
} from '@/pages/share/components/option-results'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  readTrackerResumePage,
  readTrackerVersionPage,
  trackerResumePages,
  trackerVersionPages,
  type TrackerOption,
} from '../../../lib/option-pages'

const currentVersion = { value: '', label: '云端当前已保存内容' }

export default function ResourcePicker({
  id,
  value,
  onChange,
  resumeId,
  label,
  disabled,
  emptyMessage,
}: {
  id: string
  value: string
  onChange: (option: TrackerOption) => void
  resumeId?: string
  label?: string
  disabled?: boolean
  emptyMessage?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<TrackerOption | null>(null)
  const versions = resumeId !== undefined
  const reduce = useReducedMotion()
  const name = versions ? '历史版本' : '简历'

  const result = useOptionPage(
    versions ? trackerVersionPages : trackerResumePages,
    resumeId ?? '',
    open && (!versions || Boolean(resumeId)),
    versions ? readTrackerVersionPage : readTrackerResumePage,
  )

  const selectedLabel =
    (picked?.value === value && picked.label) ||
    label ||
    (versions ? currentVersion.label : value ? '已绑定简历' : '选择简历')

  function item(option: TrackerOption) {
    return (
      <CommandItem
        key={option.value || 'current'}
        value={option.value || 'current'}
        onSelect={() => {
          setPicked(option)
          onChange(option)
          setOpen(false)
        }}
      >
        <span className='min-w-0 flex-1 truncate'>{option.label}</span>
        {option.value === value && (
          <Check aria-label='已选择' className='size-4' />
        )}
      </CommandItem>
    )
  }

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        if (next) result.onSearch('')

        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type='button'
          role='combobox'
          aria-expanded={open}
          variant='outline'
          disabled={disabled || (versions && !resumeId)}
          className='w-full min-w-0 justify-between font-normal'
        >
          <span className='truncate'>{selectedLabel}</span>
          <ChevronsUpDown className='size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        inert={!open}
        align='start'
        className='w-(--radix-popover-trigger-width) min-w-52 p-0 data-[state=closed]:pointer-events-none'
        style={reduce ? { animationDuration: '0s' } : undefined}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`搜索${name}`}
            value={result.search}
            onValueChange={result.onSearch}
            onCompositionStart={() => result.setComposing(true)}
            onCompositionEnd={() => result.setComposing(false)}
          />
          <CommandList aria-busy={result.loading}>
            <CommandGroup>
              {versions && !result.search.trim() && item(currentVersion)}
              {result.items.map(item)}
            </CommandGroup>
            <OptionResults
              result={result}
              label={name}
              emptyMessage={
                result.search.trim()
                  ? `没有匹配的${name}`
                  : (emptyMessage ?? `暂无${name}`)
              }
            />
          </CommandList>
          <OptionPagination result={result} />
        </Command>
      </PopoverContent>
    </Popover>
  )
}
