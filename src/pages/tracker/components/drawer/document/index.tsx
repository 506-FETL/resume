import PreparationActions from './preparation-actions'
import { jobContextUrl } from '@/lib/job-context'
import type { ResumePreviewData } from '../types'
import { FileText, RotateCcw } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    <div className='p-3 sm:p-4'>
      <ScaledReadonlyPreview data={normalizedData} appearance={data} />
    </div>
  )
}

export default function DrawerDocument() {
  const { jobId, resumeId } = useTrackerStore(
    useShallow((state) => ({
      jobId: state.selectedJob?.id ?? null,
      resumeId: state.selectedJob?.resume_id ?? null,
    })),
  )

  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const {
    data: resumes,
    error: listError,
    retry: retryList,
    scope,
  } = useTrackerResumeOptions(true)

  const {
    data: currentPreview,
    error: currentPreviewError,
    retry: retryPreview,
  } = useTrackerResumePreview(resumeId, true)

  const [binding, setBinding] = useState(false)
  const bindingVersionRef = useRef(0)

  useEffect(() => {
    setBinding(false)

    return () => {
      bindingVersionRef.current += 1
    }
  }, [jobId, scope])

  const handleResumeChange = async (value: string) => {
    if (!jobId || binding) return

    const version = ++bindingVersionRef.current

    setBinding(true)

    try {
      await useTrackerStore
        .getState()
        .saveJobFields(jobId, { resume_id: value })

      if (
        version === bindingVersionRef.current &&
        scope === getTrackerResumeScope()
      )
        toast.success('已绑定准备简历')
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

  return (
    <section className='min-w-0 space-y-4 border-t pt-5'>
      <header className='flex flex-wrap items-end justify-between gap-3'>
        <div className='min-w-0 flex-1 basis-44 space-y-1.5'>
          <h3 className='flex items-center gap-2 text-sm font-semibold'>
            <FileText className='size-4 text-muted-foreground' />
            准备中的简历
          </h3>
          <p className='truncate text-xs text-muted-foreground'>
            {resumeId
              ? selectedResume?.display_name || '已绑定简历'
              : '选择简历后，可在这里预览和继续编辑'}
          </p>
        </div>
        {resumes && resumes.length > 0 && (
          <div className='w-full min-w-0 space-y-1.5 sm:w-60'>
            <Label
              htmlFor='tracker-resume-select'
              className='flex items-center gap-1.5 text-xs text-muted-foreground'
            >
              {binding && (
                <Spinner
                  aria-hidden
                  className={reduce ? 'animate-none' : undefined}
                />
              )}
              <span aria-live='polite'>
                {binding ? '正在更新绑定…' : '绑定简历'}
              </span>
            </Label>
            <Select
              value={resumeId || ''}
              onValueChange={handleResumeChange}
              disabled={binding}
            >
              <SelectTrigger
                id='tracker-resume-select'
                className='w-full'
                aria-busy={binding}
              >
                <SelectValue placeholder='选择一份简历' />
              </SelectTrigger>
              <SelectContent
                style={
                  reduce
                    ? { animationDuration: '0s', transform: 'none' }
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
          </div>
        )}
      </header>
      {listError ? (
        <div
          role='alert'
          className='flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground'
        >
          <span className='min-w-0 break-words'>
            简历列表加载失败：{listError}
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
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-sm text-muted-foreground'>还没有可绑定的简历</p>
          <Button
            variant='outline'
            size='sm'
            onClick={() => navigate(jobContextUrl('/resume', jobId))}
          >
            前往我的简历
          </Button>
        </div>
      ) : null}
      <PreparationActions />
      {resumeId && (
        <div className='min-w-0 overflow-hidden rounded-lg bg-muted/35'>
          {currentPreviewError ? (
            <div
              role='alert'
              className='flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground'
            >
              <p className='break-words'>
                简历预览加载失败：{currentPreviewError}
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
    </section>
  )
}
