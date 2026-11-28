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
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EXPERIENCE_MAX_BYTES } from '@/lib/experience-sources/const'

import type { ExperienceSourceReference } from '@/lib/experience-sources/types'
import { ExperienceSourceError } from '@/lib/experience-sources/types'
import { persistExperienceUpload } from '@/lib/experience-sources/upload'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { experienceError } from '../utils'

export type { ExperienceUploadDialogProps } from './types'

export function ExperienceUploadDialog(props: ExperienceUploadDialogProps) {
  const generation = useExperienceSourcesStore((state) => state.generation)

  return <UploadDialogContent key={generation} {...props} />
}

function UploadDialogContent({
  open,
  returnFocusTo,
  onOpenChange,
  onComplete,
  initialTab = 'files',
  sourceId,
}: ExperienceUploadDialogProps) {
  const reduced = useReducedMotion()
  const [tab, setTab] = useState<UploadTab>(initialTab)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const panelClass = cn(
    'col-start-1 row-start-1 min-w-0 data-[state=inactive]:invisible data-[state=inactive]:opacity-0',
    !reduced &&
      'transition-opacity duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease)',
  )

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

  // 在浮层隔离背景前移入焦点；切换表单时不再干预用户的光标。
  const focusEntryTab = useCallback(
    (body: HTMLDivElement | null) => {
      body
        ?.querySelector<HTMLButtonElement>(
          `[role="tab"][data-tab-value="${initialTab}"]`,
        )
        ?.focus({ preventScroll: true })
    },
    [initialTab],
  )

  useLayoutEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  async function run(job: UploadJob) {
    const generation = useExperienceSourcesStore.getState().generation
    const firstAttempt = job.status === 'queued'

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
        firstAttempt,
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

      return {
        sourceId: result.source.id,
        versionId: result.versionId,
        name: result.source.name,
      }
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
      const queue = selected.entries()
      const completed: (ExperienceSourceReference | undefined)[] = []

      async function processFiles() {
        for (const [index, job] of queue) {
          if (useExperienceSourcesStore.getState().generation !== generation)
            return

          completed[index] = await run(job)
        }
      }

      // 文件读取与上传最多同时处理两份，保留列表和最终引用的选择顺序。
      await Promise.all(
        Array.from({ length: Math.min(2, selected.length) }, processFiles),
      )

      if (useExperienceSourcesStore.getState().generation !== generation) return

      const references = completed.filter(
        (reference) => reference !== undefined,
      )

      if (references.length) onCompleteRef.current?.(references)
      if (selected.every((job) => job.status === 'ready')) onOpenChange(false)
    } finally {
      savingRef.current = false

      if (useExperienceSourcesStore.getState().generation === generation)
        setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      returnFocusTo={returnFocusTo}
      open={open}
      onOpenChange={onOpenChange}
      contentClassName='gap-0 max-h-[85dvh] sm:max-w-lg [--drawer-content-height:auto]! [--drawer-content-max-height:85dvh]!'
    >
      <ResponsiveDialogHeader className='shrink-0 px-5 pt-4 pb-3 md:pr-12 md:pt-5'>
        <ResponsiveDialogTitle>
          {sourceId ? '上传新版本' : '添加职业档案'}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription className='sr-only'>
          选择文件或粘贴文字，然后保存到职业档案。
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <div
        ref={open ? focusEntryTab : undefined}
        className='min-h-0 overflow-y-auto overscroll-contain px-5 pb-4'
      >
        <Tabs
          className='gap-3'
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
          <div className='grid'>
            <TabsContent
              value='files'
              forceMount
              inert={tab !== 'files'}
              className={cn(panelClass, 'flex flex-col')}
            >
              <FileUpload
                className='flex-1'
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
                <FileUploadDropzone className='grid flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded-lg border p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]'>
                  <Upload
                    className='hidden size-5 text-muted-foreground sm:block'
                    aria-hidden
                  />
                  <div className='min-w-0 space-y-1'>
                    <p className='text-sm font-medium'>
                      <span className='hidden md:inline'>将文件拖到这里</span>
                      <span className='md:hidden'>从设备添加文件</span>
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {sourceId
                        ? '每次一份，最大 10 MB'
                        : '可多选，每份限 10 MB'}
                    </p>
                  </div>
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
            <TabsContent
              value='paste'
              forceMount
              inert={tab !== 'paste'}
              className={cn(panelClass, 'space-y-2.5')}
            >
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
                  className='h-20 min-h-20 resize-none field-sizing-fixed'
                  disabled={saving || unresolvedPaste}
                  value={text}
                  maxLength={60000}
                  onChange={(event) => setText(event.target.value)}
                  placeholder='粘贴职业背景、工作经历、项目记录等内容'
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
        <UploadJobList jobs={jobs} saving={saving} setJobs={setJobs} />
      </div>
      <ResponsiveDialogFooter className='px-5 py-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]'>
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
