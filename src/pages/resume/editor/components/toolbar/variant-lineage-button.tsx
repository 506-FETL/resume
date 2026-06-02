import { GitBranch } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VariantLineageTreeDialog } from '@/components/jd-variant/components/lineage-dialog'
import { VariantLineagePath } from '@/components/jd-variant/components/lineage-tree'
import { useVariantLineage } from '@/components/jd-variant/hooks/use-lineage'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import useResumeListStore from '@/pages/resume/store'
import useCurrentResumeStore from '@/store/resume/current'

export function VariantLineageButton() {
  const isMobile = useIsMobile()
  const { resumeId } = useCurrentResumeStore()
  const resumes = useResumeListStore(s => s.resumes)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)
  const navigate = useNavigate()
  const { setCurrentResume } = useCurrentResumeStore()

  const current = resumeId ? resumes.find(r => r.resume_id === resumeId) ?? null : null
  const parentId = current?.parent_resume_id ?? null
  // 沿父链找根：当前列表里查找祖先
  const findRoot = (id: string | null | undefined): string | null => {
    if (!id)
      return null
    const item = resumes.find(r => r.resume_id === id)
    if (!item)
      return id
    if (!item.parent_resume_id)
      return item.resume_id
    return findRoot(item.parent_resume_id)
  }
  const rootId = findRoot(resumeId)
  const disabled = !resumeId || !parentId

  const { tree } = useVariantLineage(disabled ? null : rootId)

  const handleOpen = (id: string) => {
    const target = resumes.find(r => r.resume_id === id)
    setCurrentResume(id, target?.type ?? 'default')
    navigate('/resume/editor')
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={isMobile ? 'icon' : 'sm'}
            className={cn(isMobile && 'size-9')}
            disabled={disabled}
            aria-label="查看血缘"
          >
            <GitBranch data-icon="inline-start" />
            {!isMobile && <span>血缘</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 space-y-3 p-4">
          <h3 className="text-sm font-semibold">血缘链</h3>
          <VariantLineagePath tree={tree} currentResumeId={resumeId ?? ''} />
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => {
              setPopoverOpen(false)
              setTreeOpen(true)
            }}
          >
            <GitBranch data-icon="inline-start" />
            查看完整血缘树
          </Button>
        </PopoverContent>
      </Popover>

      <VariantLineageTreeDialog
        open={treeOpen}
        onOpenChange={setTreeOpen}
        rootResumeId={rootId}
        currentResumeId={resumeId ?? ''}
        onOpen={handleOpen}
      />
    </>
  )
}
