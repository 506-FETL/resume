import type { UploadTab, UploadJob, ExperienceUploadDialogProps } from './types'
import { UploadJobList } from './upload-job-list'
import { Button } from '@/components/ui/button'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadTrigger,
} from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ResponsiveDialog,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EXPERIENCE_MAX_BYTES } from '@/lib/experience-sources/const'

import { ExperienceSourceError } from '@/lib/experience-sources/types'
import { persistExperienceUpload } from '@/lib/experience-sources/upload'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { experienceError } from '../utils'

export type { ExperienceUploadDialogProps } from './types'

export function ExperienceUploadDialog(props: ExperienceUploadDialogProps) {
  const generation = useExperienceSourcesStore((state) => state.generation)

  return <UploadDialogContent key={generation} {...props} />
}

function UploadDialogContent({
  open,
  onOpenChange,
  onComplete,
  initialTab = 'files',
  sourceId,
}: ExperienceUploadDialogProps) {
  const [tab, setTab] = useState<UploadTab>(initialTab)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const onCompleteRef = useRef(onComplete)
  const pasteDraftRef = useRef({ title, text })

  pasteDraftRef.current = { title, text }

  const pendingPaste = jobs.find(
    (job) =>
      !job.file &&
      job.sourceId === sourceId &&
      job.name === (title.trim().slice(0, 160) || '职业背景与经历') &&
      job.text === text &&
      job.status !== 'ready',
  )

  const unresolvedPaste = jobs.some(
    (job) => !job.file && job.status === 'unknown',
  )

  const canSave =
    tab === 'paste'
      ? !!text.trim()
      : jobs.some((job) => job.file && job.status !== 'ready')

  onCompleteRef.current = onComplete

  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  async function run(job: UploadJob) {
    const generation = useExperienceSourcesStore.getState().generation

    const sameAccount = () =>
      useExperienceSourcesStore.getState().generation === generation

    const update = (patch: Partial<UploadJob>) => {
      Object.assign(job, patch)

      if (sameAccount())
        setJobs((current) =>
          current.map((item) =>
            item.operationId === job.operationId ? { ...job } : item,
          ),
        )
    }

    update({ controller: new AbortController() })

    try {
      update({ status: 'reading', error: undefined })

      const result = await persistExperienceUpload({
        operationId: job.operationId,
        sourceId: job.sourceId,
        name: job.name,
        extracted: job.extracted,
        file: job.file,
        text: job.text,
        controller: job.controller,
        onExtracted: (extracted) => {
          job.extracted = extracted
        },
        onSaving: () => {
          if (!sameAccount()) job.controller.abort()

          job.controller.signal.throwIfAborted()
          update({ status: 'saving', error: undefined })
        },
      })

      if (!sameAccount()) return

      clearCompletedDraft(job)

      update({
        status: 'ready',
        file: undefined,
        extracted: undefined,
        text: undefined,
      })

      useExperienceSourcesStore.getState().invalidate(result.source.id)

      onCompleteRef.current?.([
        {
          sourceId: result.source.id,
          versionId: result.versionId,
          name: result.source.name,
        },
      ])
    } catch (cause) {
      update({
        status:
          cause instanceof DOMException && cause.name === 'AbortError'
            ? 'cancelled'
            : cause instanceof ExperienceSourceError &&
                cause.outcome === 'unknown'
              ? 'unknown'
              : 'failed',
        error: experienceError(cause),
      })
    }
  }

  function clearCompletedDraft(job: UploadJob) {
    const draft = pasteDraftRef.current

    if (
      job.file ||
      job.text !== draft.text ||
      job.name !== (draft.title.trim().slice(0, 160) || '职业背景与经历')
    )
      return

    setText('')
    setTitle('')
  }

  function addFiles(files: File[]) {
    const added = files.map(
      (file): UploadJob => ({
        operationId: crypto.randomUUID(),
        sourceId,
        name: file.name.slice(0, 160),
        file,
        status: 'queued',
        controller: new AbortController(),
      }),
    )

    setFileError(null)
    setJobs((current) => [...current, ...added])
  }

  async function save() {
    if (savingRef.current || !canSave) return

    const generation = useExperienceSourcesStore.getState().generation
    let selected = jobs.filter((job) => job.file && job.status !== 'ready')

    if (tab === 'paste') {
      const job: UploadJob = pendingPaste ?? {
        operationId: crypto.randomUUID(),
        sourceId,
        name: title.trim().slice(0, 160) || '职业背景与经历',
        text,
        status: 'queued',
        controller: new AbortController(),
      }

      if (!pendingPaste) setJobs((current) => [...current, job])

      selected = [job]
    }

    savingRef.current = true
    setSaving(true)

    try {
      for (const job of selected) {
        await run(job)

        if (useExperienceSourcesStore.getState().generation !== generation)
          return
      }

      if (selected.every((job) => job.status === 'ready')) onOpenChange(false)
    } finally {
      savingRef.current = false

      if (useExperienceSourcesStore.getState().generation === generation)
        setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName='h-[min(40rem,60dvh)] max-h-[85dvh] sm:max-w-[560px] [--drawer-content-height:min(40rem,85dvh)]! [--drawer-content-max-height:85dvh]!'
    >
      <ResponsiveDialogHeader className='shrink-0 px-6 pt-6 pb-3'>
        <ResponsiveDialogTitle>
          {sourceId ? '上传新版本' : '添加职业档案'}
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>
      <div className='min-h-0 flex-1 overflow-y-auto px-6 pb-4'>
        <Tabs
          className='h-full'
          value={tab}
          onValueChange={(value) => setTab(value as UploadTab)}
        >
          <TabsList>
            <TabsTrigger value='files' disabled={saving}>
              上传文件
            </TabsTrigger>
            <TabsTrigger value='paste' disabled={saving}>
              粘贴文字
            </TabsTrigger>
          </TabsList>
          <TabsContent value='files' className='pt-3 content-center'>
            <FileUpload
              disabled={saving}
              value={jobs.flatMap((job) => (job.file ? [job.file] : []))}
              label='选择职业档案文件'
              maxSize={EXPERIENCE_MAX_BYTES}
              multiple={!sourceId}
              maxFiles={sourceId ? 1 : undefined}
              onAccept={addFiles}
              onFileReject={(file) =>
                setFileError(
                  `${file.name}：${file.size > EXPERIENCE_MAX_BYTES ? '文件超过 10 MB。' : '更新版本时请一次选择一份文件。'}`,
                )
              }
            >
              <FileUploadDropzone className='min-h-44 gap-3'>
                <Upload className='size-7 text-muted-foreground' aria-hidden />
                <p className='text-sm'>拖入文件，或选择本机文件</p>
                <p className='text-xs text-muted-foreground'>
                  单份文件不超过 10 MB
                </p>
                <FileUploadTrigger asChild>
                  <Button variant='outline'>选择文件</Button>
                </FileUploadTrigger>
              </FileUploadDropzone>
            </FileUpload>
            {fileError && (
              <p role='alert' className='mt-2 text-sm text-destructive'>
                {fileError}
              </p>
            )}
          </TabsContent>
          <TabsContent value='paste' className='space-y-3 pt-3 content-center'>
            <div className='space-y-2'>
              <Label htmlFor='experience-title'>资料名称（选填）</Label>
              <Input
                id='experience-title'
                disabled={saving || unresolvedPaste}
                value={title}
                maxLength={160}
                onChange={(event) => setTitle(event.target.value)}
                placeholder='例如：项目复盘'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='experience-text'>资料内容</Label>
              <Textarea
                id='experience-text'
                className='min-h-44 max-h-64'
                disabled={saving || unresolvedPaste}
                value={text}
                maxLength={60000}
                onChange={(event) => setText(event.target.value)}
                placeholder='粘贴职业背景、工作经历、项目记录等内容'
              />
            </div>
          </TabsContent>
        </Tabs>
        <UploadJobList jobs={jobs} saving={saving} setJobs={setJobs} />
      </div>
      <ResponsiveDialogFooter>
        <Button disabled={saving || !canSave} onClick={save}>
          {saving && <Spinner />}
          {saving
            ? '正在保存'
            : pendingPaste?.status === 'unknown' ||
                (tab === 'files' &&
                  jobs.some((job) => job.status === 'unknown'))
              ? '核对并重试保存'
              : '保存'}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  )
}
