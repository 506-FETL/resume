import { Briefcase, FileText, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { InputGroupButton } from '@/components/ui/input-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import type { ComposerReferencePickerProps } from '../../../types'

export function ComposerReferencePicker({
  context,
  disabled,
  onSelect,
  textareaRef,
}: ComposerReferencePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectionRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const reduceMotion = useReducedMotion()
  const { resumes, jobs, retryResumes, retryJobs } = context

  const select = (token: string, label: string) => {
    selectionRef.current = true
    textareaRef.current?.focus({ preventScroll: true })
    onSelect(token, label)
    setOpen(false)
  }

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (nextOpen) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <InputGroupButton
          size='icon-sm'
          variant='outline'
          aria-label='添加参考简历或职位'
          disabled={disabled}
          className='shrink-0 rounded-full'
        >
          <Plus />
        </InputGroupButton>
      </PopoverTrigger>
      <PopoverContent
        side='top'
        align='start'
        className='w-[min(24rem,calc(100vw-2rem))] gap-0 p-0'
        style={reduceMotion ? { animationDuration: '0s' } : undefined}
        onCloseAutoFocus={(event) => {
          if (!selectionRef.current) return

          event.preventDefault()
          selectionRef.current = false
          textareaRef.current?.focus({ preventScroll: true })
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            ref={searchRef}
            aria-label='搜索参考简历或职位'
            placeholder='搜索简历或职位'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList aria-label='参考简历与职位'>
            {resumes.items.length + jobs.items.length > 0 && (
              <CommandEmpty>没有匹配的简历或职位</CommandEmpty>
            )}
            {[
              {
                key: 'resumes',
                label: '简历',
                state: resumes,
                retry: retryResumes,
              },
              { key: 'jobs', label: '职位', state: jobs, retry: retryJobs },
            ].map(({ key, label, state, retry }) => (
              <CommandGroup key={key} heading={label}>
                {state.status === 'idle' && (
                  <p
                    className='px-2 py-2 text-xs text-muted-foreground'
                    role='status'
                  >
                    正在确认账户
                  </p>
                )}
                {state.status === 'loading' && state.items.length === 0 && (
                  <div
                    className='space-y-2 px-2 py-2'
                    role='status'
                    aria-label={`正在加载${label}`}
                  >
                    <Skeleton className='h-4 w-4/5' />
                    <Skeleton className='h-4 w-3/5' />
                  </div>
                )}
                {state.status === 'loading' && state.items.length > 0 && (
                  <p
                    className='px-2 py-1 text-xs text-muted-foreground'
                    role='status'
                  >
                    正在更新{label}
                  </p>
                )}
                {state.status === 'error' && (
                  <div
                    className='flex items-center gap-2 px-2 py-1 text-xs'
                    role='alert'
                  >
                    <span className='min-w-0 flex-1 text-destructive'>
                      {label}读取失败
                    </span>
                    <Button
                      size='sm'
                      variant='ghost'
                      className='h-7 shrink-0 px-2'
                      onClick={() => {
                        searchRef.current?.focus({ preventScroll: true })
                        retry()
                      }}
                    >
                      重试{label}
                    </Button>
                  </div>
                )}
                {state.status === 'ready' && state.items.length === 0 && (
                  <p className='px-2 py-2 text-xs text-muted-foreground'>
                    暂无可引用的{label}
                  </p>
                )}
                {key === 'resumes'
                  ? resumes.items
                      .filter((resume) =>
                        `简历 ${resume.name} ${resume.resumeId}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((resume) => (
                        <CommandItem
                          key={resume.resumeId}
                          value={`简历 ${resume.name} ${resume.resumeId}`}
                          onSelect={() =>
                            select(
                              `【参考简历：${resume.name}(resumeId=${resume.resumeId})】`,
                              `简历：${resume.name}`,
                            )
                          }
                        >
                          <FileText />
                          <span className='min-w-0 whitespace-normal break-words'>
                            {resume.name}
                          </span>
                        </CommandItem>
                      ))
                  : jobs.items
                      .filter((job) =>
                        `职位 ${job.company} ${job.position} ${job.id}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((job) => (
                        <CommandItem
                          key={job.id}
                          value={`职位 ${job.company} ${job.position} ${job.id}`}
                          onSelect={() =>
                            select(
                              `【参考职位：${job.company}·${job.position}】`,
                              `职位：${job.company} · ${job.position}`,
                            )
                          }
                        >
                          <Briefcase />
                          <span className='min-w-0 whitespace-normal break-words'>
                            {job.company} · {job.position}
                          </span>
                        </CommandItem>
                      ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
