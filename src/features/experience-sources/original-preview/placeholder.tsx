import type { experiencePreviewKind } from '../../../../supabase/functions/shared/experience-file-formats'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingStatus } from '@/components/loading-status'

export function OriginalPreviewPlaceholder({
  kind,
}: {
  kind: ReturnType<typeof experiencePreviewKind>
}) {
  if (!kind || kind === 'text')
    return <LoadingStatus label='正在读取原文' className='px-0' />

  const size = {
    pdf: 'aspect-[210/297]',
    docx: 'aspect-[210/297]',
    image: 'aspect-[4/3]',
    spreadsheet: 'h-80',
  }[kind]

  return (
    <Skeleton
      aria-hidden={false}
      role='status'
      aria-label='正在准备原件预览'
      className={`w-full ${size}`}
    />
  )
}
