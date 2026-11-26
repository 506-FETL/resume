import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  listShareResumeOptions,
  type ShareResumeOption,
} from '@/lib/supabase/resume/share/option-pages'
import { useOptionPage } from '../../hooks/use-option-page'
import { resumeOptionPages } from '../../store/data/option-pages'
import { OptionPagination, OptionResults } from '../option-results'

function readResumePage(_target: string, keyword: string, offset: number) {
  return listShareResumeOptions(keyword, offset)
}

export default function ResumeCommand({
  open,
  selected,
  onSelect,
  creating = false,
}: {
  open: boolean
  selected: string[]
  onSelect: (option: ShareResumeOption) => void
  creating?: boolean
}) {
  const result = useOptionPage(resumeOptionPages, '', open, readResumePage)

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={result.search}
        onValueChange={result.onSearch}
        placeholder='搜索简历'
        onCompositionStart={() => result.setComposing(true)}
        onCompositionEnd={() => result.setComposing(false)}
      />
      <CommandList
        className='max-h-[min(18rem,calc(var(--radix-popover-content-available-height)-6rem))] overscroll-contain'
        aria-busy={result.loading}
      >
        <CommandGroup>
          {result.items.map((option) => (
            <CommandItem
              key={option.resume_id}
              value={option.resume_id}
              data-checked={creating && selected.includes(option.resume_id)}
              onSelect={() => onSelect(option)}
            >
              {!creating && (
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded border',
                    selected.includes(option.resume_id) &&
                      'border-primary bg-primary text-primary-foreground',
                  )}
                >
                  <Check
                    className={cn(
                      'size-3',
                      !selected.includes(option.resume_id) && 'opacity-0',
                    )}
                  />
                </span>
              )}
              <span className='min-w-0 flex-1 truncate'>
                {option.display_name}
              </span>
              {selected.includes(option.resume_id) && (
                <span className='sr-only'>已选择</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <OptionResults
          result={result}
          label='简历列表'
          emptyMessage={
            result.search.trim() ? (
              '没有匹配的简历'
            ) : creating ? (
              <div className='space-y-2'>
                <p>先创建或同步一份云端简历，就可以分享给他人。</p>
                <Button asChild variant='outline' size='sm'>
                  <Link to='/resume'>前往我的简历</Link>
                </Button>
              </div>
            ) : (
              '还没有云端简历'
            )
          }
        />
      </CommandList>
      <OptionPagination result={result} />
    </Command>
  )
}
