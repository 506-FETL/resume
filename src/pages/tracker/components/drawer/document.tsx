import type { ResumeOption, ResumePreviewData } from './types'
import { FileText, Loader2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFetchData } from '@/hooks/use-fetch-data'
import { getAllResumesFromUser, getResumeById, updateCompany } from '@/lib/supabase/resume'
import useTrackerStore from '../../store'
import { getTrackerErrorMessage, normalizeResumePreviewData } from '../../utils'

function SharedResumePreview({ data }: { data: ResumePreviewData }) {
  const normalizedData = useMemo(
    () => buildTemplateResumeData(normalizeResumePreviewData(data)),
    [data],
  )

  return (
    <div className="scrollbar-gutter-stable scrollbar-thin-subtle h-full overflow-y-auto bg-muted/30 p-3 sm:p-4">
      <ScaledReadonlyPreview data={normalizedData} appearance={data} />
    </div>
  )
}

export default function DrawerDocument() {
  const { selectedJob: job, syncJob, restoreJobsSnapshot } = useTrackerStore()
  const navigate = useNavigate()

  const {
    data: resumes,
    loading,
    error: resumesError,
  } = useFetchData<ResumeOption[]>(
    async () => (await getAllResumesFromUser()) as ResumeOption[],
    [],
  )

  const {
    data: previewData,
    loading: previewLoading,
    error: previewError,
  } = useFetchData<ResumePreviewData | null>(
    async () => {
      if (!job?.resume_id)
        return null
      return (await getResumeById(job.resume_id, '*')) as ResumePreviewData
    },
    [job?.resume_id],
  )

  useEffect(() => {
    if (resumesError)
      toast.error('加载简历列表失败', { description: getTrackerErrorMessage(resumesError) })
  }, [resumesError])

  useEffect(() => {
    if (previewError)
      toast.error('加载简历预览失败', { description: getTrackerErrorMessage(previewError) })
  }, [previewError])

  const handleResumeChange = (resumeId: string) => {
    if (!job)
      return

    const previousState = useTrackerStore.getState()
    const optimisticJob = {
      ...job,
      resume_id: resumeId,
    }

    syncJob(optimisticJob)

    updateCompany(job.id, { resume_id: resumeId })
      .then((savedJob) => {
        syncJob(savedJob)
      })
      .catch((error) => {
        console.error('Failed to update job resume:', error)
        restoreJobsSnapshot({
          jobs: previousState.jobs,
          selectedJob: previousState.selectedJob,
        })
        toast.error('更新失败', { description: getTrackerErrorMessage(error) })
      })
  }

  if (!job)
    return null

  const resumeList = resumes ?? []

  // 没有简历的空状态
  if (!loading && resumeList.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold tracking-tight">投递简历</h3>
          <p className="text-sm text-muted-foreground">为这条职位记录绑定一份简历，后续查看与复盘会更顺手。</p>
        </div>
        <div className="aspect-3/4 overflow-hidden rounded-2xl border border-border/60 bg-white">
          <div className="flex size-full items-center justify-center bg-muted/50">
            <div className="text-center text-muted-foreground px-6">
              <FileText className="size-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium mb-2">当前投递简历为空</p>
              <p className="text-xs mb-4">请先创建一份简历</p>
              <button
                type="button"
                onClick={() => navigate('/resume')}
                className="text-sm text-primary hover:underline font-medium cursor-pointer"
              >
                前往「我的简历」创建 →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold tracking-tight">投递简历</h3>
        <p className="text-sm text-muted-foreground">
          当前绑定到该职位的简历预览
        </p>
      </div>

      <FieldGroup className="gap-5">
        <Field className="w-40">
          <FieldLabel htmlFor="resume-select">选择简历</FieldLabel>
          <Select
            value={job.resume_id || ''}
            onValueChange={handleResumeChange}
            disabled={loading}
          >
            <SelectTrigger id="resume-select">
              <SelectValue placeholder={loading ? '加载中...' : '选择简历'} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {resumeList.map(resume => (
                  <SelectItem key={resume.resume_id} value={resume.resume_id}>
                    {resume.display_name}
                    {resume.type === 'default' && ' (默认)'}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {/* 简历预览区域 */}
        <Field>
          <FieldLabel>简历预览</FieldLabel>
          <div className="aspect-3/4 overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
            {previewLoading
              ? (
                  <div className="flex size-full items-center justify-center bg-muted/50">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  </div>
                )
              : previewData
                ? (
                    <SharedResumePreview data={previewData} />
                  )
                : (
                    <div className="flex size-full items-center justify-center bg-muted/50">
                      <div className="text-center text-muted-foreground">
                        <FileText className="size-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">请选择一份简历</p>
                      </div>
                    </div>
                  )}
          </div>
        </Field>
      </FieldGroup>
    </div>
  )
}
