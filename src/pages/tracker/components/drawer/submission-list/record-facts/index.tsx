import type { JobSubmission } from '../../../../submission-types'

export function RecordFacts({ record }: { record: JobSubmission }) {
  return (
    <dl className='grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2'>
      <div className='space-y-1'>
        <dt className='text-xs text-muted-foreground'>投递日期</dt>
        <dd>{record.submitted_on ?? '日期未知'}</dd>
      </div>
      <div className='min-w-0 space-y-1'>
        <dt className='text-xs text-muted-foreground'>投递渠道</dt>
        <dd className='break-words'>{record.channel ?? '未填写'}</dd>
      </div>
      {record.note && (
        <div className='min-w-0 space-y-1 sm:col-span-2'>
          <dt className='text-xs text-muted-foreground'>备注</dt>
          <dd className='whitespace-pre-wrap break-words'>{record.note}</dd>
        </div>
      )}
    </dl>
  )
}
