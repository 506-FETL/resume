import type { Editor } from '@tiptap/react'
import { BookmarkPlus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button as ToolbarButton } from '@/components/tiptap-ui-primitive/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import type { ExtractedExperienceFile } from '@/lib/experience-sources/types'
import { ExperienceSourceError } from '@/lib/experience-sources/types'
import { persistExperienceUpload } from '@/lib/experience-sources/upload'
import { DURATION, EASE } from '@/lib/motion'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { experienceError } from '../utils'

type ArchiveJob = {
  operationId: string
  generation: number
  fieldLabel: string
  name: string
  text: string
  extracted?: ExtractedExperienceFile
  controller: AbortController
  status: 'draft' | 'saving' | 'failed' | 'unknown' | 'ready'
  error?: string
}

interface EditorArchiveProps {
  editor: Editor
  fieldLabel: string
}

export function EditorArchive(props: EditorArchiveProps) {
  const generation = useExperienceSourcesStore((state) => state.generation)

  return <EditorArchiveDialog key={generation} {...props} />
}

function EditorArchiveDialog({ editor, fieldLabel }: EditorArchiveProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ArchiveJob | null>(null)
  const jobRef = useRef<ArchiveJob | null>(null)
  const mountedRef = useRef(true)
  const openRef = useRef(open)
  const nameId = useId()
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const saving = draft?.status === 'saving'
  const unknown = draft?.status === 'unknown'

  openRef.current = open

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setOpen(false)

      return
    }

    const state = useExperienceSourcesStore.getState()

    if (!state.ownerId) {
      toast.error('请先登录后使用职业档案。')

      return
    }

    const previous = jobRef.current

    if (previous?.status === 'saving' || previous?.status === 'unknown') {
      setOpen(true)

      return
    }

    const text = editor.getText({ blockSeparator: '\n' }).trim()

    if (
      previous?.status === 'failed' &&
      previous.text === text &&
      previous.fieldLabel === fieldLabel
    ) {
      setOpen(true)

      return
    }

    if (!text) {
      toast.info('请先填写当前字段的内容。')

      return
    }

    const job: ArchiveJob = {
      operationId: crypto.randomUUID(),
      generation: state.generation,
      fieldLabel,
      name: fieldLabel.slice(0, 160),
      text,
      controller: new AbortController(),
      status: 'draft',
    }

    jobRef.current = job
    setDraft({ ...job })
    setOpen(true)
  }

  function changeName(name: string) {
    const job = jobRef.current

    if (!job) return

    if (job.status === 'failed') {
      toast.dismiss(job.operationId)

      job.operationId = crypto.randomUUID()
      job.extracted = undefined
      job.status = 'draft'
      job.error = undefined
    }

    job.name = name
    setDraft({ ...job })
  }

  async function save(job: ArchiveJob) {
    const sameAccount = () =>
      useExperienceSourcesStore.getState().generation === job.generation

    if (job.status === 'saving' || job.status === 'ready' || !sameAccount())
      return
    if (!job.name.trim()) return

    const update = (patch: Partial<ArchiveJob>) => {
      Object.assign(job, patch)

      if (mountedRef.current && jobRef.current === job && sameAccount())
        setDraft({ ...job })
    }

    update({
      name: job.name.trim(),
      controller: new AbortController(),
      status: 'saving',
      error: undefined,
    })

    try {
      const result = await persistExperienceUpload({
        operationId: job.operationId,
        name: job.name,
        text: job.text,
        extracted: job.extracted,
        controller: job.controller,
        onExtracted: (extracted) => {
          job.extracted = extracted
        },
        onSaving: () => {},
      })

      if (!sameAccount()) return

      update({ status: 'ready' })
      useExperienceSourcesStore.getState().invalidate(result.source.id)

      if (mountedRef.current && jobRef.current === job) setOpen(false)

      toast.success('已存入职业档案', {
        id: job.operationId,
        action: {
          label: '查看',
          onClick: () => {
            if (sameAccount())
              navigate(
                `/experience?sourceId=${result.source.id}&versionId=${result.versionId}`,
              )
          },
        },
      })
    } catch (error) {
      if (!sameAccount() || job.controller.signal.aborted) return

      const outcomeUnknown =
        error instanceof ExperienceSourceError && error.outcome === 'unknown'

      update({
        status: outcomeUnknown ? 'unknown' : 'failed',
        error: experienceError(error),
      })

      if (mountedRef.current && jobRef.current === job && openRef.current)
        return

      toast.error(outcomeUnknown ? '保存结果尚未确认' : '未能存入职业档案', {
        id: job.operationId,
        description: experienceError(error),
        duration: Infinity,
        action: {
          label: outcomeUnknown ? '核对并重试' : '重试',
          onClick: () => {
            save(job)
          },
        },
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <ToolbarButton
          type='button'
          data-style='ghost'
          className='shrink-0 whitespace-nowrap'
          onKeyDownCapture={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return

            // Toolbar 会截获 Enter，直接聚焦此入口时需先交给按钮处理。
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.click()
          }}
        >
          <BookmarkPlus className='tiptap-button-icon' aria-hidden />
          <span className='tiptap-button-text'>存入职业档案</span>
        </ToolbarButton>
      </DialogTrigger>
      <DialogContent className='flex max-h-[85dvh] flex-col gap-5 sm:max-w-lg'>
        <DialogHeader className='pr-6'>
          <DialogTitle>存入职业档案</DialogTitle>
          <DialogDescription>
            保存“{draft?.fieldLabel ?? fieldLabel}”的全部文字。
          </DialogDescription>
        </DialogHeader>
        <form
          className='flex min-h-0 flex-col gap-5'
          onSubmit={(event) => {
            event.preventDefault()

            if (jobRef.current) save(jobRef.current)
          }}
        >
          <div className='min-h-0 space-y-4 overflow-y-auto'>
            <div className='space-y-2'>
              <Label htmlFor={nameId}>资料名称</Label>
              <Input
                id={nameId}
                autoComplete='off'
                required
                maxLength={160}
                value={draft?.name ?? ''}
                disabled={saving || unknown}
                onChange={(event) => changeName(event.target.value)}
              />
            </div>
            <section aria-label='本次保存内容' className='space-y-2'>
              <div className='flex items-center justify-between gap-3 text-xs text-muted-foreground'>
                <span>本次保存内容</span>
                <span>{draft?.text.length ?? 0} 字符</span>
              </div>
              <p className='max-h-48 overflow-y-auto rounded-md bg-muted/40 p-3 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap'>
                {draft?.text}
              </p>
            </section>
            <AnimatePresence initial={false}>
              {draft?.error && (
                <motion.div
                  key='archive-error'
                  initial={{
                    opacity: 0,
                    transform: reduced ? 'none' : 'translateY(8px)',
                  }}
                  animate={{
                    opacity: 1,
                    transform: reduced ? 'none' : 'translateY(0)',
                  }}
                  exit={{
                    opacity: 0,
                    transform: reduced ? 'none' : 'translateY(4px)',
                    transition: {
                      duration: reduced ? 0 : DURATION.fast,
                      ease: EASE.in,
                    },
                  }}
                  transition={{
                    duration: reduced ? 0 : DURATION.base,
                    ease: EASE.out,
                  }}
                >
                  <Alert variant='destructive'>
                    <AlertTitle>
                      {unknown ? '保存结果尚未确认' : '未能存入职业档案'}
                    </AlertTitle>
                    <AlertDescription>{draft.error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <DialogFooter className='shrink-0'>
            <Button
              type='submit'
              disabled={saving || !draft?.name.trim()}
              aria-busy={saving}
            >
              {saving && <Spinner />}
              {saving ? '正在保存' : unknown ? '核对并重试保存' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
