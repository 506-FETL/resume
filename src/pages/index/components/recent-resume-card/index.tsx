import {
  ArrowUpRight,
  Cloud,
  FileCheck2,
  GitBranch,
  HardDrive,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { lazy, Suspense, useRef } from 'react'
import { useInView } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import useCurrentResumeStore from '@/store/resume/current'
import {
  RESUME_BADGE_COLORS,
  RESUME_CARD_APPEARANCE,
} from '@/pages/resume/components/resume-card/const'
import type { Resume } from '../../types'

const ResumeThumbnail = lazy(() => import('./resume-thumbnail'))

export default function RecentResumeCard({ resume }: { resume: Resume }) {
  const navigate = useNavigate()
  const previewRef = useRef<HTMLDivElement>(null)
  const previewVisible = useInView(previewRef, { once: true })

  const tone = resume.parent_resume_id
    ? 'variant'
    : resume.isOffline
      ? 'local'
      : 'cloud'

  const appearance = RESUME_CARD_APPEARANCE[tone]

  const Icon =
    tone === 'variant' ? GitBranch : resume.isOffline ? HardDrive : Cloud

  const updatedAt = resume.updated_at || resume.created_at

  function openResume(check = false) {
    useCurrentResumeStore
      .getState()
      .setCurrentResume(resume.resume_id, resume.type)

    navigate(check ? '/resume/editor?check=1' : '/resume/editor')
  }

  return (
    <article className='grid min-w-0 grid-cols-[88px_minmax(0,1fr)] overflow-hidden rounded-lg border bg-card sm:grid-cols-[120px_minmax(0,1fr)]'>
      <div
        ref={previewRef}
        className='flex min-w-0 items-center justify-center bg-muted/25 px-2.5 py-3 sm:px-3.5'
      >
        <div className='relative aspect-[210/297] w-full overflow-hidden rounded-sm bg-white shadow-sm'>
          <Suspense fallback={<PreviewLoading />}>
            {previewVisible ? (
              <ResumeThumbnail resumeId={resume.resume_id} />
            ) : (
              <PreviewLoading />
            )}
          </Suspense>
        </div>
      </div>
      <div className='flex min-w-0 flex-col gap-3 p-3 sm:p-4'>
        <div className='min-w-0'>
          <Badge
            variant='outline'
            className={cn('mb-1.5', RESUME_BADGE_COLORS[tone])}
          >
            <Icon className='size-3' />
            {appearance.label}
          </Badge>
          <h3
            className='line-clamp-2 text-base leading-6 font-semibold break-words'
            title={resume.display_name || '未命名简历'}
          >
            {resume.display_name || '未命名简历'}
          </h3>
          <p className='mt-1 text-xs text-muted-foreground'>
            {tone === 'variant' &&
              `${resume.isOffline ? '本地' : '云端'}保存 · `}
            <time dateTime={updatedAt}>
              {new Date(updatedAt).toLocaleDateString('zh-CN')}
            </time>
            {' 更新'}
          </p>
        </div>
        <div className='mt-auto flex flex-wrap items-center gap-x-1 gap-y-1.5'>
          <Button size='sm' onClick={() => openResume()}>
            继续编辑 <ArrowUpRight className='size-3.5' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-muted-foreground'
            onClick={() => openResume(true)}
          >
            <FileCheck2 className='size-3.5' /> 检查并导出
          </Button>
        </div>
      </div>
    </article>
  )
}

function PreviewLoading() {
  return (
    <div
      className='flex h-full items-center justify-center px-2 text-center text-xs text-neutral-500'
      role='status'
    >
      正在加载预览…
    </div>
  )
}
