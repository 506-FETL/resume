import PreparationActions from './preparation-actions'
import { jobContextUrl } from '@/lib/job-context'
import type { ResumePreviewData } from '../types'
import { ChevronDown, FileText, RotateCcw } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  getTrackerResumeScope,
  useTrackerResumeOptions,
  useTrackerResumePreview,
} from '../../../lib/resume-resources'
import useTrackerStore from '../../../store'
import {
  getTrackerErrorMessage,
  normalizeResumePreviewData,
} from '../../../utils'

function SharedResumePreview({ data }: { data: ResumePreviewData }) {
  const normalizedData = useMemo(
    () => buildTemplateResumeData(normalizeResumePreviewData(data)),
    [data],
  )

  return (
    <div className='scrollbar-gutter-stable scrollbar-thin-subtle h-full overflow-y-auto bg-muted/30 p-3 sm:p-4'>
      <ScaledReadonlyPreview data={normalizedData} appearance={data} />
    </div>
  )
}

interface DrawerDocumentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function DrawerDocument({
  open,
  onOpenChange,
}: DrawerDocumentProps) {
  const { jobId, resumeId } = useTrackerStore(
    useShallow((state) => ({
      jobId: state.selectedJob?.id ?? null,
      resumeId: state.selectedJob?.resume_id ?? null,
    })),
  )

  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const {
    data: resumes,
    error: listError,
    retry: retryList,
    scope,
  } = useTrackerResumeOptions(open)

  const {
    data: currentPreview,
    error: currentPreviewError,
    retry: retryPreview,
  } = useTrackerResumePreview(resumeId, open)

  const [binding, setBinding] = useState(false)
  const bindingVersionRef = useRef(0)

  useEffect(() => {
    setBinding(false)

    return () => {
      bindingVersionRef.current += 1
    }
  }, [open, jobId, scope])

  const handleResumeChange = async (value: string) => {
    if (!jobId || binding) return

    const version = ++bindingVersionRef.current

    setBinding(true)

    try {
      await useTrackerStore
        .getState()
        .saveJobFields(jobId, { resume_id: value })
    } catch (error) {
      if (
        version === bindingVersionRef.current &&
        scope === getTrackerResumeScope()
      )
        toast.error('绑定简历失败', {
          description: getTrackerErrorMessage(error),
        })
    } finally {
      if (
        version === bindingVersionRef.current &&
        scope === getTrackerResumeScope()
      )
        setBinding(false)
    }
  }

  if (!jobId) return null

  const selectedResume = resumes?.find(
    (resume) => resume.resume_id === resumeId,
  )

  const transitionStyle = {
    transitionDuration: `${reduce ? 0 : DURATION.base}s`,
    transitionTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        if (!next && contentRef.current?.contains(document.activeElement))
          triggerRef.current?.focus()

        onOpenChange(next)
      }}
      className='overflow-hidden rounded-xl border bg-card'
    >
      <CollapsibleTrigger
        ref={triggerRef}
        className='flex w-full cursor-pointer items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
        style={transitionStyle}
      >
        <span className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted'>
          <FileText className='size-5 text-muted-foreground' />
        </span>
        <span className='min-w-0 flex-1 space-y-1'>
          <span className='block text-sm font-medium'>准备中的简历</span>
          <span className='block truncate text-xs text-muted-foreground'>
            {resumeId
              ? selectedResume?.display_name || '已绑定简历'
              : '未绑定简历'}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          style={transitionStyle}
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        ref={contentRef}
        style={{
          animationDuration: `${reduce ? 0 : DURATION.base}s`,
          animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
        }}
      >
        <div className='space-y-4 border-t p-4'>
          <PreparationActions />
          {listError ? (
            <div
              role='alert'
              className='flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground'
            >
              <span>
                简历列表加载失败：
                {listError}
              </span>
              <Button variant='outline' size='sm' onClick={retryList}>
                <RotateCcw className='size-3.5' />
                重试列表
              </Button>
            </div>
          ) : !resumes ? (
            <div
              role='status'
              className='flex items-center gap-2 py-2 text-sm text-muted-foreground'
            >
              <Spinner aria-hidden className='motion-reduce:animate-none' />
              正在加载简历列表
            </div>
          ) : resumes.length === 0 ? (
            <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-4'>
              <p className='text-sm text-muted-foreground'>
                还没有可绑定的简历
              </p>
              <Button
                variant='outline'
                size='sm'
                onClick={() => navigate(jobContextUrl('/resume', jobId))}
              >
                前往我的简历
              </Button>
            </div>
          ) : (
            <div className='space-y-2'>
              <Label
                htmlFor='tracker-resume-select'
                className='text-xs font-medium text-muted-foreground'
              >
                绑定简历
              </Label>
              <Select
                value={resumeId || ''}
                onValueChange={handleResumeChange}
                disabled={binding}
              >
                <SelectTrigger
                  id='tracker-resume-select'
                  className='w-52 max-w-full'
                >
                  <SelectValue placeholder='选择一份简历' />
                </SelectTrigger>
                <SelectContent
                  style={
                    reduce
                      ? { animation: 'none', transform: 'none' }
                      : undefined
                  }
                >
                  {resumes.map((resume) => (
                    <SelectItem key={resume.resume_id} value={resume.resume_id}>
                      {resume.display_name}
                      {resume.type === 'default' && '（默认）'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {binding && (
                <p role='status' className='text-xs text-muted-foreground'>
                  正在更新绑定…
                </p>
              )}
            </div>
          )}
          {resumeId && (
            <div
              className={cn(
                'overflow-hidden rounded-lg border',
                currentPreview
                  ? 'h-[min(65dvh,48rem)] bg-white'
                  : 'bg-muted/30',
              )}
            >
              {currentPreviewError ? (
                <div
                  role='alert'
                  className='flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground'
                >
                  <p>
                    简历预览加载失败：
                    {currentPreviewError}
                  </p>
                  <Button variant='outline' size='sm' onClick={retryPreview}>
                    重试预览
                  </Button>
                </div>
              ) : currentPreview ? (
                <SharedResumePreview data={currentPreview} />
              ) : (
                <div
                  role='status'
                  className='flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground'
                >
                  <Spinner aria-hidden className='motion-reduce:animate-none' />
                  正在加载简历预览
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
