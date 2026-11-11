import { GitBranch } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VariantLineageTreeDialog } from '@/components/jd-variant/components/lineage-dialog'
import { VariantLineagePath } from '@/components/jd-variant/components/lineage-tree'
import { useVariantLineage } from '@/components/jd-variant/hooks/use-lineage'
import AnimatedContent from '@/components/motion/animated-content'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import useResumeListStore from '@/pages/resume/store'
import useCurrentResumeStore from '@/store/resume/current'

export function VariantLineageButton({
  reviewActive = false,
}: {
  reviewActive?: boolean
}) {
  const isMobile = useIsMobile()
  const { resumeId } = useCurrentResumeStore()
  const resumes = useResumeListStore((s) => s.resumes)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)
  const navigate = useNavigate()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { setCurrentResume } = useCurrentResumeStore()

  const current = resumeId
    ? (resumes.find((r) => r.resume_id === resumeId) ?? null)
    : null

  const parentId = current?.parent_resume_id ?? null

  // 沿父链找根：当前列表里查找祖先
  const findRoot = (id: string | null | undefined): string | null => {
    if (!id) return null

    const item = resumes.find((r) => r.resume_id === id)

    if (!item) return id
    if (!item.parent_resume_id) return item.resume_id

    return findRoot(item.parent_resume_id)
  }

  const rootId = findRoot(resumeId)
  const disabled = reviewActive || !resumeId || !parentId

  const { tree, loading, error, refresh } = useVariantLineage(
    disabled ? null : rootId,
    popoverOpen || treeOpen,
  )

  const handleOpen = (id: string) => {
    const target = resumes.find((r) => r.resume_id === id)

    setCurrentResume(id, target?.type ?? 'default')
    navigate('/resume/editor')
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant='outline'
            size={isMobile ? 'icon' : 'sm'}
            className={cn(isMobile && 'size-9')}
            disabled={disabled}
            aria-label='查看派生关系'
            title={reviewActive ? '请先切回当前工作版本' : undefined}
          >
            <GitBranch data-icon='inline-start' />
            {!isMobile && <span>派生关系</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='flex w-80 flex-col gap-3 p-4'>
          <h3 className='text-sm font-semibold'>派生关系</h3>
          <AnimatedContent
            animationKey={error ? 'error' : loading ? 'loading' : 'ready'}
          >
            {error ? (
              <Alert variant='destructive'>
                <AlertDescription>{error}</AlertDescription>
                <Button
                  size='sm'
                  variant='outline'
                  className='mt-2'
                  onClick={() => {
                    triggerRef.current?.focus({ preventScroll: true })
                    refresh()
                  }}
                >
                  重试
                </Button>
              </Alert>
            ) : loading ? (
              <p className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Spinner aria-label='正在加载派生关系' />
              </p>
            ) : (
              <VariantLineagePath
                tree={tree}
                currentResumeId={resumeId ?? ''}
              />
            )}
          </AnimatedContent>
          <Separator />
          <Button
            size='sm'
            variant='outline'
            className='w-full'
            onClick={() => {
              setPopoverOpen(false)
              setTreeOpen(true)
            }}
          >
            <GitBranch data-icon='inline-start' />
            查看完整派生关系
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
