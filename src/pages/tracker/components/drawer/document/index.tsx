import { createDeferredComponent } from '@/components/deferred-content'
import PreparationActions from './preparation-actions'
import { jobContextUrl } from '@/lib/job-context'
import type { ResumePreviewData } from '../types'
import { FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PaperSkeleton } from '@/components/loading-skeleton'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Spinner } from '@/components/ui/spinner'
import ResourcePicker from '../resource-picker'
import {
  getTrackerResumeScope,
  useTrackerResumePreview,
} from '../../../lib/resume-resources'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'

const SharedResumePreview = createDeferredComponent<{
  data: ResumePreviewData
}>(
  () => import('./bound-preview'),
  '简历预览',
  <PaperSkeleton label='正在加载简历预览' className='mx-auto max-w-lg' />,
  { wrapFallback: false },
)

export default function DrawerDocument() {
  const { jobId, resumeId } = useTrackerStore(
    useShallow((state) => ({
      jobId: state.selectedJob?.id ?? null,
      resumeId: state.selectedJob?.resume_id ?? null,
    })),
  )

  const navigate = useNavigate()

  const {
    scope,
    data: currentPreview,
    error: currentPreviewError,
    retry: retryPreview,
  } = useTrackerResumePreview(resumeId, true)

  useEffect(() => {
    if (resumeId) SharedResumePreview.preload().catch(() => {})
  }, [resumeId])

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
              ? currentPreview?.display_name || '已绑定简历'
              : '选择简历后，可在这里预览和继续编辑'}
          </p>
        </div>
        <div className='w-full min-w-0 space-y-1.5 sm:w-60'>
          <Label
            htmlFor='tracker-resume-select'
            className='flex items-center gap-1.5 text-xs text-muted-foreground'
          >
            {binding && <Spinner aria-hidden />}
            <span aria-live='polite'>
              {binding ? '正在更新绑定…' : '绑定简历'}
            </span>
          </Label>
          <ResourcePicker
            id='tracker-resume-select'
            value={resumeId || ''}
            label={currentPreview?.display_name}
            disabled={binding}
            onChange={(option) => handleResumeChange(option.value)}
            emptyMessage={
              <div className='space-y-2'>
                <p>还没有可绑定的简历</p>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => navigate(jobContextUrl('/resume', jobId))}
                >
                  前往我的简历
                </Button>
              </div>
            }
          />
        </div>
      </header>
      <PreparationActions />
      {resumeId && (
        <AnimatedContent
          animationKey={
            currentPreviewError ? 'error' : currentPreview ? 'ready' : 'loading'
          }
          className='min-w-0 overflow-hidden rounded-lg bg-muted/35'
        >
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
            <PaperSkeleton
              label='正在加载简历预览'
              className='mx-auto max-w-lg'
            />
          )}
        </AnimatedContent>
      )}
    </section>
  )
}
