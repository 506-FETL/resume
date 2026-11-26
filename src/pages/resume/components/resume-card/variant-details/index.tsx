import { GitBranch } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AnimatedContent from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import useResumeListStore from '@/pages/resume/store'
import type { ResumeItem } from '@/pages/resume/types'
import useCurrentResumeStore from '@/store/resume/current'
import { RESUME_BADGE_COLORS } from '../const'
import { VariantBadge } from '../variant-badge'

export function VariantDetails({
  resume,
  onEdit,
}: {
  resume: ResumeItem
  onEdit: () => void
}) {
  const parentId = resume.parent_resume_id

  const parent = useResumeListStore((s) =>
    parentId ? s.libraryParents[parentId] : undefined,
  )

  const parentError = useResumeListStore((s) =>
    parentId ? s.libraryParentErrors[parentId] : undefined,
  )

  const status = resume.derived_status

  return (
    <div className='mt-2 flex min-w-0 flex-wrap items-center gap-2'>
      {status === 'generating' || status === 'failed' ? (
        <Badge variant='outline' className={RESUME_BADGE_COLORS[status]}>
          <GitBranch aria-hidden />
          {status === 'generating' ? '生成中' : '生成失败'}
        </Badge>
      ) : parentId ? (
        <VariantBadge
          onEdit={onEdit}
          parentName={parent ? parent.display_name || '未命名简历' : null}
          matchRate={
            resume.derived_match_rate ??
            resume.derived_metadata?.matchRate ??
            null
          }
        />
      ) : null}
      {parentId && (
        <AnimatedContent
          animationKey={
            parent
              ? 'ready'
              : parent === null
                ? 'missing'
                : parentError
                  ? 'error'
                  : 'loading'
          }
          className='min-w-0 max-w-full text-xs text-muted-foreground'
        >
          <VariantSource id={parentId} parent={parent} error={parentError} />
        </AnimatedContent>
      )}
    </div>
  )
}

function VariantSource({
  id,
  parent,
  error,
}: {
  id: string
  parent: ResumeItem | null | undefined
  error?: string
}) {
  const navigate = useNavigate()

  if (parent) {
    return (
      <Button
        type='button'
        variant='link'
        size='sm'
        className='h-auto min-w-0 max-w-full px-0 py-0 text-xs font-normal text-muted-foreground'
        onClick={() => {
          useCurrentResumeStore
            .getState()
            .setCurrentResume(parent.resume_id, parent.type)

          navigate('/resume/editor')
        }}
      >
        <span className='truncate'>
          来自 {parent.display_name || '未命名简历'}
        </span>
      </Button>
    )
  }

  if (parent === null) return <span>找不到原简历</span>
  if (error) {
    return (
      <div className='flex items-center gap-1'>
        <span>原简历信息加载失败</span>
        <Button
          type='button'
          variant='link'
          size='sm'
          className='h-auto p-0 text-xs'
          aria-label='重试读取原简历'
          onClick={() => useResumeListStore.getState().loadLibraryParents([id])}
        >
          重试
        </Button>
      </div>
    )
  }

  return (
    <div role='status'>
      <span className='sr-only'>正在读取原简历</span>
      <Skeleton className='h-3 w-16' />
    </div>
  )
}
