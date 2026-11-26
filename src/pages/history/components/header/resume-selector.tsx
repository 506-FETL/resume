import { FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime } from '@/utils/date'
import useUserStore from '@/store/user'
import useCurrentResumeStore from '@/store/resume/current'
import { RESUME_TYPE_LABEL_MAP } from '../../const'
import { useResumeOptions } from '../../store/options'
import useHistoryStore from '../../store'
import HistoryOptionPicker from '../shared/option-picker'

export default function HistoryResumeSelector({
  value,
}: {
  value: string | null
}) {
  const data = useResumeOptions()
  const owner = useUserStore((s) => s.currentUser?.id)

  const current = useHistoryStore((s) =>
    s.currentResume?.resumeId === value ? s.currentResume : null,
  )

  const unavailable = useHistoryStore(
    (s) => s.resumeId === value && Boolean(s.currentResumeError),
  )

  const selected = current ?? data.items.find((item) => item.resumeId === value)

  return (
    <HistoryOptionPicker
      emptyLabel='暂无可选简历'
      id='history-resume-selector'
      label='选择简历'
      value={value}
      data={data}
      trigger={
        selected ? (
          <>
            <FileText
              aria-hidden
              className='size-4 shrink-0 text-muted-foreground'
            />
            <span className='truncate font-medium'>{selected.displayName}</span>
            <span className='hidden shrink-0 text-xs text-muted-foreground sm:inline'>
              {RESUME_TYPE_LABEL_MAP[selected.type]}
            </span>
          </>
        ) : value ? (
          unavailable ? (
            '已选择云端简历'
          ) : (
            '正在读取所选简历'
          )
        ) : (
          '选择一份云端简历'
        )
      }
      itemId={(row) => row.resumeId}
      itemLabel={(row) => row.displayName}
      onOpen={() => {
        if (owner) data.load(owner, 'open')
      }}
      onMore={() => {
        if (owner) data.load(owner, 'more')
      }}
      onChange={(id) => {
        const item = data.items.find((row) => row.resumeId === id)

        if (item)
          useCurrentResumeStore.getState().setCurrentResume(id, item.type)
      }}
      renderItem={(row) => (
        <div className='min-w-0 space-y-1 py-1'>
          <div className='flex min-w-0 items-center gap-2'>
            <span className='truncate font-medium'>{row.displayName}</span>
            <Badge variant='outline' className='shrink-0 text-[10px]'>
              {RESUME_TYPE_LABEL_MAP[row.type]}
            </Badge>
          </div>
          <span className='text-xs text-muted-foreground'>
            {row.updatedAt
              ? `${formatRelativeTime(row.updatedAt)}更新`
              : '暂无更新时间'}
          </span>
        </div>
      )}
    />
  )
}
