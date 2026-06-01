import type { MouseEvent } from 'react'
import type { ResumeItem } from '../../types'
import { Cloud, Edit2, FileText, GitBranch, HardDrive, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import useResumeListStore from '@/pages/resume/store'
import useCurrentResumeStore from '@/store/resume/current'
import DeleteResumeDialog from '../delete-resume-dialog'
import EditResumeDialog from '../edit-resume-dialog'
import { VariantBadge } from './variant-badge'

interface ResumeCardProps {
  resume: ResumeItem
}

export default function ResumeCard({ resume }: ResumeCardProps) {
  const { deleteResume, updateResume, openDeriveFor, resumes } = useResumeListStore()
  const { setCurrentResume } = useCurrentResumeStore()
  const isMobile = useIsMobile()

  const navigate = useNavigate()
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

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
    openDeriveFor(resume.resume_id)
  }

  const handleParentClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!parent)
      return
    setCurrentResume(parent.resume_id, parent.type)
    navigate('/resume/editor')
  }

  return (
    <>
      <Card
        className="hover:shadow-lg transition-all duration-300 cursor-pointer relative h-full flex flex-col"
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 删除按钮 */}
        <Button
          onClick={handleDeleteClick}
          size="icon"
          className={cn(
            'absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-linear-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg hover:cursor-pointer',
            isMobile
              ? 'opacity-100 scale-100 rotate-0'
              : isHovered
                ? 'opacity-100 scale-100 rotate-0'
                : 'opacity-0 scale-0 rotate-90',
          )}
          aria-label="删除简历"
        >
          <X className="h-4 w-4" />
        </Button>

        <CardHeader>
          <div className="flex items-center justify-between">
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex items-center gap-2">
              {isVariant && (
                <VariantBadge
                  parentName={parent?.display_name ?? null}
                  jdSnippet={resume.linked_jd_text ? resume.linked_jd_text.slice(0, 80) : null}
                  matchRate={resume.derived_metadata?.matchRate ?? null}
                />
              )}
              {isGenerating && (
                <Badge variant="secondary" className="text-xs rounded-full">
                  <GitBranch className="h-3 w-3 mr-1" />
                  生成中
                </Badge>
              )}
              {isFailed && (
                <Badge variant="destructive" className="text-xs rounded-full">
                  <GitBranch className="h-3 w-3 mr-1" />
                  生成失败
                </Badge>
              )}
              {resume.isOffline
                ? (
                    <Badge variant="secondary" className="text-xs rounded-full">
                      <HardDrive className="h-3 w-3 mr-1" />
                      本地
                    </Badge>
                  )
                : (
                    <Badge variant="default" className="text-xs bg-blue-400 rounded-full">
                      <Cloud className="h-3 w-3 mr-1" />
                      云端
                    </Badge>
                  )}
              <span className="text-xs text-muted-foreground">{new Date(resume.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <CardTitle>{resume.display_name || `未命名简历`}</CardTitle>
          <CardDescription>{resume.description || '点击编辑简历内容'}</CardDescription>
          {parent && (
            <button
              type="button"
              onClick={handleParentClick}
              className="mt-2 text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 hover:underline"
            >
              <GitBranch className="size-3" aria-hidden />
              派生自
              {' '}
              {parent.display_name || '未命名简历'}
            </button>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={handleEditClick} className="flex-1">
            <Edit2 />
            编辑信息
          </Button>
          <Button
            variant="outline"
            onClick={handleDeriveClick}
            className="flex-1"
            disabled={isGenerating}
            aria-label="派生针对性版本"
          >
            <Sparkles />
            派生
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
