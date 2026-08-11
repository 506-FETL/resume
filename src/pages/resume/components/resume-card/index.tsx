import type { MouseEvent } from 'react'
import type { ResumeItem } from '../../types'
import { Cloud, Edit2, FileText, GitBranch, HardDrive, Share2, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import useResumeListStore from '@/pages/resume/store'
import useShareStore from '@/pages/share/store'
import useJdVariantStore from '@/store/jd-variant'
import useCurrentResumeStore from '@/store/resume/current'
import DeleteResumeDialog from '../delete-resume-dialog'
import EditResumeDialog from '../edit-resume-dialog'
import { RESUME_BADGE_COLORS } from './const'
import { VariantBadge } from './variant-badge'

interface ResumeCardProps {
  resume: ResumeItem
}

export default function ResumeCard({ resume }: ResumeCardProps) {
  const { deleteResume, updateResume, openDeriveFor, resumes } = useResumeListStore()
  const { setCurrentResume } = useCurrentResumeStore()
  const { openDialog: openShareDialog } = useShareStore()

  const navigate = useNavigate()
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const parent = useMemo(() => {
    if (!resume.parent_resume_id)
      return null
    return resumes.find(r => r.resume_id === resume.parent_resume_id) ?? null
  }, [resume.parent_resume_id, resumes])

  const isVariant = Boolean(resume.parent_resume_id)
  const isGenerating = resume.derived_status === 'generating'
  const isFailed = resume.derived_status === 'failed'

  const handleUpdateSuccess = (updates: { display_name: string, description: string }) => {
    updateResume(resume.resume_id, updates)
  }

  const handleCardClick = () => {
    setCurrentResume(resume.resume_id, resume.type)
    navigate('/resume/editor')
  }

  const handleEditClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setShowEditDialog(true)
  }

  const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = () => {
    deleteResume(resume.resume_id)
    setShowDeleteDialog(false)
  }

  const handleDeriveClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const task = useJdVariantStore.getState().tasks[resume.resume_id]
    if (task && (task.phase === 'success' || task.phase === 'error' || task.phase === 'aborted'))
      useJdVariantStore.getState().clearTask(resume.resume_id)
    openDeriveFor(resume.resume_id)
  }

  const handleParentClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!parent)
      return
    setCurrentResume(parent.resume_id, parent.type)
    navigate('/resume/editor')
  }

  const handleShareClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (resume.isOffline)
      return
    openShareDialog(resume.resume_id, resume.display_name || '未命名简历')
  }

  return (
    <>
      <Card
        className="group h-full cursor-pointer gap-5 py-5 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-md focus-within:border-primary/30"
        onClick={handleCardClick}
      >
        <CardHeader className="gap-4 px-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="size-5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">{new Date(resume.created_at).toLocaleDateString()}</span>
          </div>
          <CardAction>
            <Button
              type="button"
              onClick={handleDeleteClick}
              size="icon-sm"
              variant="ghost"
              aria-label="删除简历"
            >
              <X />
            </Button>
          </CardAction>
          <div className="flex flex-wrap items-center gap-1.5">
            {isVariant && (
              <VariantBadge
                parentName={parent?.display_name ?? null}
                jdSnippet={resume.linked_jd_text ? resume.linked_jd_text.slice(0, 80) : null}
                matchRate={resume.derived_metadata?.matchRate ?? null}
              />
            )}
            {isGenerating && (
              <Badge variant="outline" className={RESUME_BADGE_COLORS.generating}>
                <GitBranch />
                生成中
              </Badge>
            )}
            {isFailed && (
              <Badge variant="outline" className={RESUME_BADGE_COLORS.failed}>
                <GitBranch />
                生成失败
              </Badge>
            )}
            {resume.isOffline
              ? (
                  <Badge variant="outline" className={RESUME_BADGE_COLORS.local}>
                    <HardDrive />
                    本地
                  </Badge>
                )
              : (
                  <Badge variant="outline" className={RESUME_BADGE_COLORS.cloud}>
                    <Cloud />
                    云端
                  </Badge>
                )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 px-5">
          <div className="flex flex-col gap-1">
            <CardTitle className="line-clamp-1">{resume.display_name || '未命名简历'}</CardTitle>
            <CardDescription className="line-clamp-2">{resume.description || '点击编辑简历内容'}</CardDescription>
          </div>
          {parent && (
            <Button
              type="button"
              size="xs"
              variant="link"
              onClick={handleParentClick}
              className="max-w-full justify-start"
            >
              <GitBranch data-icon="inline-start" aria-hidden />
              <span className="truncate">
                派生自
                {' '}
                {parent.display_name || '未命名简历'}
              </span>
            </Button>
          )}
        </CardContent>
        <CardFooter className="mt-auto flex flex-col gap-2 px-5">
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleEditClick} className="flex-1">
              <Edit2 data-icon="inline-start" />
              编辑信息
            </Button>
            <Button
              variant="outline"
              onClick={handleDeriveClick}
              className="flex-1"
              disabled={isGenerating}
              aria-label="派生针对性版本"
            >
              <Sparkles data-icon="inline-start" />
              派生
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={handleShareClick}
            className="w-full"
            disabled={resume.isOffline}
            title={resume.isOffline ? '离线简历需先同步到云端才能分享' : undefined}
          >
            <Share2 data-icon="inline-start" />
            {resume.isOffline ? '同步后可分享' : '分享'}
          </Button>
        </CardFooter>
      </Card>

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
