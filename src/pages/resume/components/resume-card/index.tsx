import {
  bindJobResume,
  jobContextUrl,
  useJobContextStore,
} from '@/lib/job-context'
import { toast } from 'sonner'
import type { MouseEvent } from 'react'
import type { ResumeItem } from '../../types'
import {
  Cloud,
  Edit2,
  GitBranch,
  HardDrive,
  MoreHorizontal,
  Share2,
  Sparkles,
} from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MagicCard } from '@/components/ui/magic-card'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'
import useResumeListStore from '@/pages/resume/store'
import useShareStore from '@/pages/share/store'
import useJdVariantStore from '@/store/jd-variant'
import useCurrentResumeStore from '@/store/resume/current'
import DeleteResumeDialog from '../delete-resume-dialog'
import EditResumeDialog from '../edit-resume-dialog'
import TemplateBadge from '../template-badge'
import { RESUME_BADGE_COLORS, RESUME_CARD_APPEARANCE } from './const'
import { VariantBadge } from './variant-badge'

interface ResumeCardProps {
  resume: ResumeItem
  onPrepareForJob?: () => Promise<void>
}

export default function ResumeCard({
  resume,
  onPrepareForJob,
}: ResumeCardProps) {
  const { deleteResume, updateResume, openDeriveFor, resumes } =
    useResumeListStore()

  const { setCurrentResume } = useCurrentResumeStore()
  const { openDialog: openQuickDialog } = useShareStore()

  const navigate = useNavigate()
  const [routeParams] = useSearchParams()
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const parent = useMemo(() => {
    if (!resume.parent_resume_id) return null

    return resumes.find((r) => r.resume_id === resume.parent_resume_id) ?? null
  }, [resume.parent_resume_id, resumes])

  const shouldReduceMotion = useReducedMotion()
  const isVariant = Boolean(resume.parent_resume_id)
  const tone = isVariant ? 'variant' : resume.isOffline ? 'local' : 'cloud'
  const appearance = RESUME_CARD_APPEARANCE[tone]
  const TypeIcon = isVariant ? GitBranch : resume.isOffline ? HardDrive : Cloud
  const updatedAt = resume.updated_at || resume.created_at
  const updatedLabel = new Date(updatedAt).toLocaleDateString('zh-CN')
  const isGenerating = resume.derived_status === 'generating'
  const isFailed = resume.derived_status === 'failed'

  const handleUpdateSuccess = (updates: {
    display_name: string
    description: string
  }) => {
    updateResume(resume.resume_id, updates)
  }

  const handleCardClick = async () => {
    const jobId = routeParams.get('jobId')

    try {
      if (jobId) {
        if (resume.isOffline) {
          toast.info('请先将这份简历同步到云端，再用于岗位准备')

          return
        }

        const context = await bindJobResume(jobId, resume.resume_id)

        if (useJobContextStore.getState().context?.id !== jobId) return

        useJobContextStore.getState().setContext(context)
      }

      setCurrentResume(resume.resume_id, resume.type)

      navigate(
        jobId ? jobContextUrl('/resume/editor', jobId) : '/resume/editor',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '关联失败，请重试')
    }
  }

  const handleDeleteConfirm = () => {
    deleteResume(resume.resume_id)
    setShowDeleteDialog(false)
  }

  const handleDeriveClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()

    const task = useJdVariantStore.getState().tasks[resume.resume_id]

    if (
      task &&
      (task.phase === 'success' ||
        task.phase === 'error' ||
        task.phase === 'aborted')
    )
      useJdVariantStore.getState().clearTask(resume.resume_id)

    openDeriveFor(resume.resume_id)
  }

  const handleParentClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()

    if (!parent) return

    setCurrentResume(parent.resume_id, parent.type)
    navigate('/resume/editor')
  }

  const handleShareClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()

    if (resume.isOffline) return

    openQuickDialog(resume.resume_id, resume.display_name || '未命名简历')
  }

  return (
    <>
      <MagicCard
        mode='orb'
        glowFrom={appearance.glowFrom}
        glowTo={appearance.glowTo}
        gradientFrom={appearance.glowFrom}
        gradientTo={appearance.glowTo}
        borderColor='var(--resume-card-border)'
        glowSize={240}
        glowBlur={48}
        glowOpacity={0.16}
        className={cn('group h-full shadow-xs', appearance.border)}
        contentClassName='flex h-full min-h-48 flex-col p-4'
      >
        {onPrepareForJob && (
          <Button
            size='sm'
            variant='outline'
            className='relative z-1 mb-3'
            onClick={onPrepareForJob}
          >
            设为此岗位准备中的简历
          </Button>
        )}
        <button
          type='button'
          aria-label={`编辑${resume.display_name || '未命名简历'}`}
          data-resume-edit-trigger={resume.resume_id}
          className='absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring'
          onClick={handleCardClick}
        />
        <div className='pointer-events-none relative flex items-center gap-2.5 [&_button]:pointer-events-auto'>
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              appearance.icon,
            )}
          >
            <TypeIcon className='size-4' aria-hidden />
          </div>
          <div className='min-w-0 flex-1 space-y-0.5'>
            <div className='flex flex-wrap items-center gap-1.5'>
              <span className={cn('text-xs font-medium', appearance.text)}>
                {appearance.label}
              </span>
              {isVariant && (
                <span className='inline-flex items-center gap-1 text-[11px] text-muted-foreground'>
                  {resume.isOffline ? (
                    <HardDrive className='size-3' aria-hidden />
                  ) : (
                    <Cloud className='size-3' aria-hidden />
                  )}
                  {resume.isOffline ? '本地' : '云端'}
                </span>
              )}
            </div>
            <div className='flex items-center gap-1 text-[11px] leading-4 text-muted-foreground'>
              <span>{resume.updated_at ? '更新于' : '创建于'}</span>
              <time dateTime={updatedAt}>{updatedLabel}</time>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type='button'
                size='icon-sm'
                variant='ghost'
                className='-mr-1 text-muted-foreground'
                aria-label='简历更多操作'
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
                编辑信息
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setShowDeleteDialog(true)}
                className='text-destructive'
              >
                删除简历
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className='pointer-events-none relative mt-3 flex min-w-0 flex-1 flex-col gap-1.5 [&_button]:pointer-events-auto'>
          <h2
            className='line-clamp-2 text-sm leading-5 font-semibold'
            title={resume.display_name || '未命名简历'}
          >
            {resume.display_name || '未命名简历'}
          </h2>
          <TemplateBadge binding={resume.templateBinding} />
          {resume.description && (
            <p
              className='line-clamp-1 text-xs leading-5 text-muted-foreground'
              title={resume.description}
            >
              {resume.description}
            </p>
          )}
          <div className='flex min-w-0 items-center gap-1.5'>
            {isGenerating && (
              <Badge
                variant='outline'
                className={RESUME_BADGE_COLORS.generating}
              >
                <GitBranch aria-hidden />
                生成中
              </Badge>
            )}
            {isFailed && (
              <Badge variant='outline' className={RESUME_BADGE_COLORS.failed}>
                <GitBranch aria-hidden />
                生成失败
              </Badge>
            )}
            {isVariant && !isGenerating && !isFailed && (
              <VariantBadge
                onEdit={handleCardClick}
                parentName={parent?.display_name ?? null}
                jdSnippet={
                  resume.linked_jd_text
                    ? resume.linked_jd_text.slice(0, 80)
                    : null
                }
                matchRate={resume.derived_metadata?.matchRate ?? null}
              />
            )}
            {parent && (
              <button
                type='button'
                onClick={handleParentClick}
                className='min-w-0 truncate rounded-sm text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring'
                style={{
                  transitionDuration: shouldReduceMotion
                    ? '0s'
                    : `${DURATION.fast}s`,
                }}
                title={`原始简历：${parent.display_name || '未命名简历'}`}
              >
                来自 {parent.display_name || '未命名简历'}
              </button>
            )}
          </div>
        </div>

        <div className='pointer-events-none relative mt-3 flex items-center gap-1.5 border-t border-border/60 pt-3 [&_button]:pointer-events-auto!'>
          <Button
            size='sm'
            onClick={handleCardClick}
            className='min-w-0 flex-1 text-xs'
          >
            <Edit2 data-icon='inline-start' className='size-3.5' />
            编辑简历
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={handleDeriveClick}
            className='gap-1 px-2 text-xs text-muted-foreground'
            disabled={isGenerating}
            aria-label='创建岗位版本'
          >
            <Sparkles className='size-3.5' />
            岗位版本
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={handleShareClick}
            className='gap-1 px-2 text-xs text-muted-foreground'
            disabled={resume.isOffline}
            title={
              resume.isOffline ? '本地简历需先同步到云端才能分享' : undefined
            }
          >
            <Share2 className='size-3.5' />
            分享
          </Button>
        </div>
      </MagicCard>

      {/* 编辑对话框 */}
      <EditResumeDialog
        resume={resume}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={handleUpdateSuccess}
      />

      {/* 删除确认对话框 */}
      <DeleteResumeDialog
        resumeName={resume.display_name || '未命名简历'}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}
