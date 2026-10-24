import type { HistoryResumeOption } from '../../types'
import { AlertCircle, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatRelativeTime } from '@/utils/date'
import { useHistoryMotion } from '../../hooks/use-history-motion'
import { getResumeTypeLabel } from '../../utils'

interface HistoryResumeSelectorProps {
  value: string | null
  options: HistoryResumeOption[]
  loading: boolean
  error: string | null
  onChange: (resumeId: string) => void
}

export default function HistoryResumeSelector({
  value,
  options,
  loading,
  error,
  onChange,
}: HistoryResumeSelectorProps) {
  const { surfaceProps } = useHistoryMotion()
  const selectedResume = options.find((option) => option.resumeId === value)

  return (
    <div className='flex w-full min-w-0 flex-col gap-2'>
      <div className='flex min-w-0 items-center gap-3'>
        <label htmlFor='history-resume-selector' className='sr-only'>
          选择简历
        </label>
        <Select
          value={value ?? ''}
          onValueChange={onChange}
          disabled={loading || options.length === 0}
        >
          <SelectTrigger
            id='history-resume-selector'
            aria-label='选择简历'
            aria-invalid={Boolean(error)}
            className='w-full min-w-0 bg-background text-left shadow-none'
          >
            <SelectValue
              placeholder={loading ? '正在加载简历…' : '选择一份云端简历'}
            >
              {selectedResume && (
                <span className='flex min-w-0 items-center gap-2'>
                  <FileText className='size-4 shrink-0 text-muted-foreground' />
                  <span className='truncate font-medium'>
                    {selectedResume.displayName}
                  </span>
                  <span className='hidden shrink-0 text-xs text-muted-foreground sm:inline'>
                    {getResumeTypeLabel(selectedResume.type)}
                  </span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            {...surfaceProps}
            position='popper'
            align='start'
            className={`${surfaceProps.className} history-popup-motion scrollbar-thin-subtle max-h-80 w-(--radix-select-trigger-width) max-w-[calc(100vw-2rem)]`}
          >
            <SelectGroup>
              {options.map((option) => (
                <SelectItem
                  key={option.resumeId}
                  value={option.resumeId}
                  textValue={option.displayName}
                >
                  <div className='flex min-w-0 flex-col gap-1.5 py-1 pr-3'>
                    <div className='flex min-w-0 items-center gap-2'>
                      <span className='truncate font-medium'>
                        {option.displayName}
                      </span>
                      <Badge variant='outline' className='shrink-0 text-[10px]'>
                        {getResumeTypeLabel(option.type)}
                      </Badge>
                    </div>
                    <span className='text-xs text-muted-foreground'>
                      {option.updatedAt
                        ? `${formatRelativeTime(option.updatedAt)}更新`
                        : '暂无更新时间'}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p
          role='alert'
          className='flex items-center gap-1.5 text-xs text-destructive'
        >
          <AlertCircle className='size-3.5 shrink-0' />
          {error}
        </p>
      )}
    </div>
  )
}
