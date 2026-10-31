import {
  bindJobResume,
  jobContextUrl,
  useJobContextStore,
} from '@/lib/job-context'
import { toast } from 'sonner'
import type { MouseEvent } from 'react'
import type { ResumeItem } from '../../types'
import {
  Check,
  Cloud,
  Edit2,
  GitBranch,
  HardDrive,
  MoreHorizontal,
  Share2,
  Sparkles,
} from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DURATION } from '@/lib/motion'
import useResumeListStore from '@/pages/resume/store'
import useShareStore from '@/pages/share/store'
import useJdVariantStore from '@/store/jd-variant'
import useCurrentResumeStore from '@/store/resume/current'
import useUserStore from '@/store/user'
import DeleteResumeDialog from '../delete-resume-dialog'
import EditResumeDialog from '../edit-resume-dialog'
import TemplateBadge from '../template-badge'
import { RESUME_BADGE_COLORS, RESUME_CARD_APPEARANCE } from './const'
import { VariantBadge } from './variant-badge'
import ResumeFocusPreview from './resume-focus-preview'

interface ResumeCardProps {
  resume: ResumeItem
  onDeletedClose?: () => void
  onPrepareForJob?: () => Promise<void>
  preparedForJob?: boolean
  preparingForJob?: boolean
  prepareDisabled?: boolean
}

export default function ResumeCard({
  resume,
  onDeletedClose,
  onPrepareForJob,
  preparedForJob = false,
  preparingForJob = false,
  prepareDisabled = false,
}: ResumeCardProps) {
  const { deleteResume, updateResume, openDeriveFor, libraryParents } =
    useResumeListStore()

  const accountId = useUserStore((state) => state.currentUser?.id ?? null)

  const { setCurrentResume } = useCurrentResumeStore()
  const { openDialog: openQuickDialog } = useShareStore()

  const navigate = useNavigate()
  const [routeParams] = useSearchParams()
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const actionAfterCloseRef = useRef<(() => void) | null>(null)

  const parent = useMemo(() => {
    if (!resume.parent_resume_id) return null

    return libraryParents[resume.parent_resume_id] ?? null
  }, [resume.parent_resume_id, libraryParents])

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
      <article
        data-resume-row={resume.resume_id}
        className='group relative grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-center gap-x-5 gap-y-4 rounded-lg px-2 py-5 transition-colors ease-(--ui-motion-enter-ease) hover:bg-muted/35 focus-within:bg-muted/35 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-x-8 sm:px-4 sm:py-6'
        style={{
          transitionDuration: shouldReduceMotion ? '0s' : `${DURATION.fast}s`,
        }}
      >
        <button
          type='button'
          aria-label={`编辑${resume.display_name || '未命名简历'}`}
          data-resume-edit-trigger={resume.resume_id}
          className='absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring'
          onClick={handleCardClick}
        />
        <ResumeFocusPreview
          key={`${accountId ?? 'offline'}:${resume.resume_id}:${updatedAt}`}
          accountId={accountId}
          resumeId={resume.resume_id}
          updatedAt={updatedAt}
          templateBinding={resume.templateBinding}
        />
        <div className='pointer-events-none relative flex min-w-0 flex-1 items-start gap-3 [&_button]:pointer-events-auto'>
          <div className='min-w-0 flex-1'>
            <h2
              className='line-clamp-2 text-xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-[1.75rem]'
              title={resume.display_name || '未命名简历'}
            >
              {resume.display_name || '未命名简历'}
            </h2>
            <div className='mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground'>
              <Badge variant='outline' className={RESUME_BADGE_COLORS[tone]}>
                <TypeIcon aria-hidden />
                {appearance.label}
              </Badge>
              <div className='min-w-0 max-w-full'>
                <TemplateBadge binding={resume.templateBinding} />
              </div>
              {isVariant && (
                <span className='inline-flex items-center gap-1'>
                  {resume.isOffline ? (
                    <HardDrive className='size-3' aria-hidden />
                  ) : (
                    <Cloud className='size-3' aria-hidden />
                  )}
                  {resume.isOffline ? '本地保存' : '云端保存'}
                </span>
              )}
              <time dateTime={updatedAt} className='tabular-nums'>
                {resume.updated_at ? '更新于' : '创建于'} {updatedLabel}
              </time>
            </div>
            {resume.description && (
              <p
                className='mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]'
                title={resume.description}
              >
                {resume.description}
              </p>
            )}
            {(isGenerating || isFailed || isVariant || parent) && (
              <div className='mt-2 flex min-w-0 flex-wrap items-center gap-2'>
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
                  <Badge
                    variant='outline'
                    className={RESUME_BADGE_COLORS.failed}
                  >
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
                  <Button
                    type='button'
                    variant='link'
                    size='sm'
                    onClick={handleParentClick}
                    className='h-auto min-w-0 max-w-full shrink px-0 py-0 text-xs font-normal text-muted-foreground'
                    title={`原始简历：${parent.display_name || '未命名简历'}`}
                  >
                    <span className='truncate'>
                      来自 {parent.display_name || '未命名简历'}
                    </span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className='pointer-events-none relative col-span-2 flex shrink-0 flex-wrap items-center gap-x-1 gap-y-2 sm:col-span-1 sm:col-start-2 [&_button]:pointer-events-auto!'>
          {onPrepareForJob && (
            <Button
              size='sm'
              variant={preparedForJob ? 'secondary' : 'outline'}
              disabled={prepareDisabled || preparedForJob}
              aria-busy={preparingForJob}
              onClick={onPrepareForJob}
              className='h-9'
            >
              {preparingForJob ? (
                <Spinner aria-label='正在设置' />
              ) : preparedForJob ? (
                <Check />
              ) : null}
              {preparingForJob
                ? '正在设置…'
                : preparedForJob
                  ? '已用于此岗位'
                  : '设为准备简历'}
            </Button>
          )}
          <Button
            size='sm'
            onClick={handleCardClick}
            className='h-9 px-2 text-xs sm:px-3 sm:text-sm'
          >
            <Edit2 data-icon='inline-start' className='size-3.5' />
            继续编辑
          </Button>
          <div className='flex items-center gap-0.5'>
            <Button
              size='sm'
              variant='ghost'
              onClick={handleDeriveClick}
              className='h-9 gap-1 px-2 text-xs text-muted-foreground'
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
              className='h-9 gap-1 px-2 text-xs text-muted-foreground'
              disabled={resume.isOffline}
              title={
                resume.isOffline ? '本地简历需先同步到云端才能分享' : undefined
              }
            >
              <Share2 className='size-3.5' />
              分享
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={menuTriggerRef}
                  type='button'
                  size='icon'
                  variant='ghost'
                  className='text-muted-foreground'
                  aria-label='简历更多操作'
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='end'
                onCloseAutoFocus={(event) => {
                  const action = actionAfterCloseRef.current

                  if (!action) return

                  event.preventDefault()
                  actionAfterCloseRef.current = null
                  menuTriggerRef.current?.focus({ preventScroll: true })
                  action()
                }}
              >
                <DropdownMenuItem
                  onSelect={() => {
                    actionAfterCloseRef.current = () => setShowEditDialog(true)
                  }}
                >
                  编辑信息
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    actionAfterCloseRef.current = () =>
                      setShowDeleteDialog(true)
                  }}
                  className='text-destructive'
                >
                  删除简历
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </article>

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
        onDeletedClose={onDeletedClose}
      />
    </>
  )
}
