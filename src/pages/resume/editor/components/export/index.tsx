import type { ReactNode } from 'react'
import type { PreparationIssue } from '@/lib/resume-preparation/checks'
import { FileText, Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
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
import { DURATION, EASE } from '@/lib/motion'
import { checkResumePreparation } from '@/lib/resume-preparation/checks'
import {
  useDerivedEvidence,
  usePreparationRecord,
} from '@/lib/resume-preparation/hooks'
import { updatePreparation } from '@/lib/resume-preparation/storage'
import useResumeExportStore from '@/store/resume/export'
import useResumeStore from '@/store/resume/form'
import useUserStore from '@/store/user'
import { usePreparationUiStore } from '../../preparation-store'
import { useResumeReviewStore } from '../../review-store'
import CheckList from './check-list'

interface ExportDialogProps {
  trigger: ReactNode
}

export default function ExportDialog({ trigger }: ExportDialogProps) {
  const { exportToPdf, exportToDoc, documentState } = useResumeExportStore()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  const form = useResumeStore()
  const resumeId = form.currentResumeId
  const reviewActive = useResumeReviewStore((state) => state.active)
  const preparation = usePreparationRecord(resumeId, open)
  const derived = useDerivedEvidence(resumeId, form, open)
  const reducedMotion = useReducedMotion()
  const [searchParams, setSearchParams] = useSearchParams()
  const pendingEditRef = useRef<PreparationIssue | null>(null)
  const snapshot = form.isInitialized ? form.getPersistedSnapshot() : null
  const record = preparation.record

  const mergedRecord = record
    ? {
        ...record,
        evidence: [
          ...new Map(
            [...derived.evidence, ...record.evidence].map((item) => [
              item.id,
              item,
            ]),
          ).values(),
        ],
      }
    : null

  const issues =
    mergedRecord && snapshot
      ? checkResumePreparation(snapshot, mergedRecord)
      : []

  const unresolved = issues.filter((issue) => !issue.resolved)
  const error = preparation.error ?? derived.error

  const blocked =
    busy ||
    !form.isInitialized ||
    !resumeId ||
    reviewActive ||
    preparation.loading ||
    preparation.refreshing ||
    derived.loading ||
    !!error ||
    !record ||
    unresolved.length > 0

  useEffect(() => {
    if (searchParams.get('check') !== '1' || !form.isInitialized) return

    setOpen(true)

    const next = new URLSearchParams(searchParams)

    next.delete('check')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, form.isInitialized])

  useEffect(() => {
    setWriteError(null)
  }, [resumeId, preparation.ownerId])

  const resolveIssue = async (
    issue: PreparationIssue,
    reason: string | null,
  ) => {
    if (!resumeId || busy || reviewActive || !mergedRecord) return

    const targetId = resumeId
    const targetOwner = preparation.ownerId

    setBusy(true)
    setWriteError(null)

    try {
      await updatePreparation(targetId, targetOwner, (value) => {
        const resolutions = { ...value.resolutions }

        if (reason?.trim())
          resolutions[issue.id] = {
            signature: issue.signature,
            reason: reason.trim(),
          }
        else delete resolutions[issue.id]

        return { ...value, resolutions }
      })
    } catch (reason) {
      if (
        useResumeStore.getState().currentResumeId === targetId &&
        (useUserStore.getState().currentUser?.id ?? null) === targetOwner
      ) {
        setWriteError(
          reason instanceof Error ? reason.message : '处理记录保存失败，请重试',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  const exportDocument = async (format: 'pdf' | 'word') => {
    if (blocked || useResumeReviewStore.getState().active) return

    // 实际按钮触发前重查当前字段，不能沿用渲染前的检查快照。
    const current = useResumeStore.getState()

    if (
      current.currentResumeId !== resumeId ||
      (useUserStore.getState().currentUser?.id ?? null) !==
        preparation.ownerId ||
      !mergedRecord ||
      checkResumePreparation(current.getPersistedSnapshot(), mergedRecord).some(
        (issue) => !issue.resolved,
      )
    ) {
      toast.error('简历内容已变化，请重新检查后导出')

      return
    }

    setOpen(false)

    if (format === 'pdf') await exportToPdf()
    else exportToDoc()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        style={{
          animationDuration: `${reducedMotion ? 0 : open ? DURATION.base : DURATION.fast}s`,
          animationTimingFunction: `cubic-bezier(${(open ? EASE.out : EASE.in).join(',')})`,
        }}
        className={`flex max-h-[85dvh] flex-col gap-4 sm:max-w-xl ${reducedMotion ? 'animate-none! duration-0!' : ''}`}
        overlayClassName={
          reducedMotion
            ? 'animate-none! duration-0!'
            : 'preparation-dialog-overlay'
        }
        onCloseAutoFocus={() => {
          const issue = pendingEditRef.current

          pendingEditRef.current = null

          if (issue && resumeId)
            requestAnimationFrame(() =>
              usePreparationUiStore
                .getState()
                .requestEdit(resumeId, issue.section),
            )
        }}
      >
        <style>{`.preparation-dialog-overlay[data-state="open"]{animation-duration:${DURATION.base}s;animation-timing-function:cubic-bezier(${EASE.out.join(',')})}.preparation-dialog-overlay[data-state="closed"]{animation-duration:${DURATION.fast}s;animation-timing-function:cubic-bezier(${EASE.in.join(',')})}`}</style>
        <DialogHeader className='shrink-0'>
          <DialogTitle>检查并导出</DialogTitle>
          <DialogDescription>
            来源和处理记录仅保存在本浏览器，请核对简历后再导出。Word
            可能替换设备中缺失的字体。
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
          {reviewActive ? (
            <p role='alert'>请先回到当前简历，再检查并导出。</p>
          ) : preparation.loading || derived.loading ? (
            <p role='status'>正在读取检查记录和内容来源…</p>
          ) : error && !record ? (
            <div role='alert' className='space-y-3'>
              <p>{error}</p>
              <Button
                variant='outline'
                onClick={() => {
                  preparation.retry()
                  derived.retry()
                }}
              >
                重试检查
              </Button>
            </div>
          ) : (
            <>
              {error && (
                <div
                  role='alert'
                  className='mb-3 space-y-2 text-sm text-destructive'
                >
                  <p>{error}</p>
                  <Button variant='outline' onClick={preparation.retry}>
                    重试读取记录
                  </Button>
                </div>
              )}
              <p className='mb-3 text-sm text-muted-foreground'>
                {unresolved.length
                  ? `还有 ${unresolved.length} 项待处理`
                  : '检查已完成'}
              </p>
              <CheckList
                issues={issues}
                busy={busy}
                onResolve={resolveIssue}
                onLocate={(issue) => {
                  pendingEditRef.current = issue
                  setOpen(false)
                }}
              />
            </>
          )}
          {writeError && (
            <p role='alert' className='mt-3 text-sm text-destructive'>
              {writeError}
            </p>
          )}
        </div>
        <DialogFooter className='flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end'>
          <Button
            variant='outline'
            onClick={() => exportDocument('pdf')}
            disabled={blocked || documentState.status !== 'ready'}
            title={documentState.error ?? undefined}
          >
            <Printer data-icon='inline-start' />
            {documentState.status === 'measuring'
              ? '分页准备中…'
              : documentState.status === 'error'
                ? '分页失败'
                : '导出 PDF'}
          </Button>
          <Button onClick={() => exportDocument('word')} disabled={blocked}>
            <FileText data-icon='inline-start' />
            导出 Word
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
