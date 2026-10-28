import type { ReactNode } from 'react'
import type { CheckFilter } from '../../store/checks'
import type { PreparationRecord } from '@/lib/resume-preparation/types'
import { AlertCircle, FileText, Printer, Sparkles } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { checkResume } from '@/lib/resume-checks/rules'
import useResumeExportStore from '@/store/resume/export'
import useResumeStore from '@/store/resume/form'
import useUserStore from '@/store/user'
import { useResumeReviewStore } from '../../review-store'
import { useResumeCheckStore } from '../../store/checks'
import { getCheckCategories } from './utils'
import { CHECK_LEVELS } from '../../utils/check-presentation'
import { cn } from '@/lib/utils'

interface ExportDialogProps {
  trigger: ReactNode
}

const EMPTY_RECORD: PreparationRecord = { evidence: [], resolutions: {} }

export default function ExportDialog({ trigger }: ExportDialogProps) {
  const { documentState, sourceRef, handlePrint, isSourceCurrent } =
    useResumeExportStore()

  const form = useResumeStore()
  const checks = useResumeCheckStore()
  const ownerId = useUserStore((state) => state.currentUser?.id ?? null)
  const reviewActive = useResumeReviewStore((state) => state.active)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [clickFailure, setClickFailure] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const pendingCheckRef = useRef<{
    filter: CheckFilter
    issueId?: string
  } | null>(null)

  const reducedMotion = useReducedMotion()
  const resumeId = form.currentResumeId
  const identity = `${ownerId ?? 'guest'}:${resumeId}`
  const sameIdentity = checks.identity === identity
  const record = sameIdentity ? checks.record : null

  const snapshot = useMemo(
    () => (open && form.isInitialized ? form.getPersistedSnapshot() : null),
    [open, form],
  )

  const snapshotSignature = snapshot ? JSON.stringify(snapshot) : ''
  const snapshotKey = JSON.stringify([identity, snapshotSignature])

  const localCheck = useMemo(() => {
    if (!snapshot) return null

    try {
      return {
        result: checkResume(snapshot, record ?? EMPTY_RECORD),
        failed: false,
      }
    } catch {
      return { result: null, failed: true }
    }
  }, [snapshot, record])

  const currentChecks =
    sameIdentity && checks.snapshotSignature === snapshotSignature

  const rulesFailed =
    !!localCheck?.failed ||
    (currentChecks && checks.ruleStatus === 'error') ||
    clickFailure === snapshotKey

  const additionalIssues = currentChecks
    ? checks.issues.filter((issue) => issue.source !== 'rule')
    : []

  const issues = [...(localCheck?.result?.issues ?? []), ...additionalIssues]

  const errors = issues.filter(
    (issue) => !issue.resolved && issue.severity === 'error',
  )

  const snapshotReady = !!snapshot && !!resumeId && !reviewActive
  const blocked = busy || !snapshotReady
  const sourceReady = documentState.status === 'ready' && !!isSourceCurrent?.()
  const pdfReady = sourceReady && !!handlePrint
  const wordReady = sourceReady && !!sourceRef?.current
  const sourceStatus = sameIdentity ? checks.sourceStatus : 'loading'
  const sourceFailed = sourceStatus === 'error'
  const proofreadFailed = sameIdentity && checks.proofreadStatus === 'error'

  useEffect(() => {
    if (searchParams.get('check') !== '1' || !form.isInitialized) return

    setOpen(true)

    const next = new URLSearchParams(searchParams)

    next.delete('check')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, form.isInitialized])

  const changeOpen = (next: boolean) => {
    if (next) {
      pendingCheckRef.current = null
      setClickFailure(null)
    }

    setOpen(next)
  }

  const viewChecks = (filter: CheckFilter, issueId?: string) => {
    pendingCheckRef.current = { filter, issueId }
    setOpen(false)
  }

  const exportDocument = async (format: 'pdf' | 'word') => {
    if (busy || useResumeReviewStore.getState().active) return

    const current = useResumeStore.getState()
    const currentOwner = useUserStore.getState().currentUser?.id ?? null
    const currentIdentity = `${currentOwner ?? 'guest'}:${current.currentResumeId}`
    const exporter = useResumeExportStore.getState()

    if (!current.isInitialized || !current.currentResumeId) return
    if (currentIdentity !== identity || !snapshotReady) return
    if (
      !exporter.isSourceCurrent?.() ||
      exporter.documentState.status !== 'ready'
    )
      return
    if (format === 'pdf' && !exporter.handlePrint) return
    if (format === 'word' && !exporter.sourceRef?.current) return

    const latestSnapshot = current.getPersistedSnapshot()
    const latestSignature = JSON.stringify(latestSnapshot)

    const latestChecks = useResumeCheckStore.getState()

    const latestRecord =
      latestChecks.identity === currentIdentity ? latestChecks.record : null

    try {
      checkResume(latestSnapshot, latestRecord ?? EMPTY_RECORD)
    } catch {
      setClickFailure(JSON.stringify([currentIdentity, latestSignature]))
      toast.warning('暂时无法完成检查，仍会继续导出')
    }

    setBusy(true)
    setOpen(false)

    try {
      if (format === 'pdf') await exporter.exportToPdf()
      else exporter.exportToDoc()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        style={{
          animationDuration: `${reducedMotion ? 0 : open ? DURATION.base : DURATION.fast}s`,
          animationTimingFunction: `cubic-bezier(${(open ? EASE.out : EASE.in).join(',')})`,
        }}
        className={`flex max-h-[85dvh] flex-col gap-4 sm:max-w-lg ${reducedMotion ? 'animate-none! duration-0!' : ''}`}
        overlayClassName={
          reducedMotion ? 'animate-none! duration-0!' : 'resume-export-overlay'
        }
        onCloseAutoFocus={() => {
          const pendingCheck = pendingCheckRef.current

          pendingCheckRef.current = null

          if (pendingCheck) {
            requestAnimationFrame(() => {
              const current = useResumeStore.getState()

              const currentOwner =
                useUserStore.getState().currentUser?.id ?? null

              if (
                `${currentOwner ?? 'guest'}:${current.currentResumeId}` !==
                identity
              )
                return

              useResumeCheckStore
                .getState()
                .requestChecks(pendingCheck.filter, pendingCheck.issueId)
            })
          }
        }}
      >
        <style>{`.resume-export-overlay[data-state="open"]{animation-duration:${DURATION.base}s;animation-timing-function:cubic-bezier(${EASE.out.join(',')})}.resume-export-overlay[data-state="closed"]{animation-duration:${DURATION.fast}s;animation-timing-function:cubic-bezier(${EASE.in.join(',')})}`}</style>
        <DialogHeader className='shrink-0'>
          <DialogTitle>导出简历</DialogTitle>
          <DialogDescription className='sr-only'>
            查看当前简历的检查摘要，选择 PDF 或 Word 导出。
          </DialogDescription>
          <p className='truncate pr-6 text-sm text-muted-foreground'>
            {form.basics.name ? `${form.basics.name}的简历` : '当前简历'}
          </p>
        </DialogHeader>
        <div className='min-h-0 flex-1 space-y-3 overflow-y-auto'>
          {!snapshotReady ? (
            <p role='status' className='text-sm text-muted-foreground'>
              {reviewActive
                ? '请先回到当前简历，再导出。'
                : '正在准备简历内容…'}
            </p>
          ) : (
            <>
              <div className='divide-y rounded-lg border px-4'>
                {(['error', 'warning', 'suggestion'] as const).map(
                  (severity) => {
                    const level = CHECK_LEVELS[severity]
                    const Icon = level.icon

                    const items = issues.filter(
                      (issue) => !issue.resolved && issue.severity === severity,
                    )

                    const emptyLabel =
                      severity === 'error'
                        ? '未发现明确错误'
                        : severity === 'warning'
                          ? '暂无待核对内容'
                          : '暂无建议'

                    return (
                      <div
                        key={severity}
                        data-export-severity={severity}
                        className='flex items-center gap-3 py-3'
                      >
                        <div className='min-w-0 flex-1'>
                          <p
                            className={cn(
                              'flex items-center gap-2 font-medium',
                              level.color,
                            )}
                          >
                            <Icon className='size-4 shrink-0' aria-hidden />
                            {level.label}
                            <Badge className={level.badge} variant='secondary'>
                              {rulesFailed && severity === 'error'
                                ? '未完成'
                                : items.length}
                            </Badge>
                          </p>
                          <p className='mt-1 text-xs text-muted-foreground'>
                            {items.length
                              ? `${getCheckCategories(items)}${severity === 'error' ? '' : '，不影响导出。'}`
                              : rulesFailed
                                ? '部分检查未完成，仍可导出。'
                                : emptyLabel}
                          </p>
                        </div>
                        {items.length > 0 && (
                          <Button
                            size='sm'
                            variant='ghost'
                            aria-label={`查看${level.label}`}
                            onClick={() => viewChecks(severity, items[0]?.id)}
                          >
                            查看
                          </Button>
                        )}
                      </div>
                    )
                  },
                )}
                <div className='py-3'>
                  <p
                    className={cn(
                      'flex items-center gap-2 font-medium',
                      sourceFailed || checks.aiCount > 0
                        ? CHECK_LEVELS.warning.color
                        : 'text-muted-foreground',
                    )}
                  >
                    <Sparkles className='size-4 shrink-0' aria-hidden />
                    AI 来源
                  </p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {sourceFailed
                      ? '来源记录读取失败，无法统计；仍可导出。'
                      : sourceStatus === 'loading'
                        ? '正在读取来源记录，可继续导出。'
                        : !currentChecks
                          ? '正在核对当前内容的 AI 来源，可继续导出。'
                          : sameIdentity && checks.aiCount
                            ? `有 ${checks.aiCount} 处内容使用过 AI，请自行核实。`
                            : '未记录 AI 生成内容。'}
                  </p>
                </div>
              </div>
              {proofreadFailed && (
                <p
                  role='status'
                  className='flex items-start gap-2 text-xs text-muted-foreground'
                >
                  <AlertCircle className='mt-0.5 size-3.5 shrink-0' />
                  {rulesFailed
                    ? 'AI 校对也未完成，可继续导出。'
                    : 'AI 校对失败，本地检查仍可用，可继续导出。'}
                </p>
              )}
            </>
          )}
          {snapshotReady && !pdfReady && (
            <p role='status' className='text-xs text-muted-foreground'>
              {documentState.error ?? 'PDF 分页准备中…'}
            </p>
          )}
          {snapshotReady && !wordReady && (
            <p role='status' className='text-xs text-muted-foreground'>
              Word 内容准备中…
            </p>
          )}
          <p className='text-xs text-muted-foreground'>
            Word 可能替换设备中缺失的字体。
          </p>
        </div>
        <DialogFooter className='grid shrink-0 grid-cols-2 gap-2 border-t pt-4 sm:flex sm:justify-end'>
          <Button
            className='col-span-2 sm:mr-auto'
            variant='ghost'
            onClick={() => setOpen(false)}
          >
            返回编辑
          </Button>
          <Button
            variant={errors.length ? 'destructive' : 'outline'}
            onClick={() => exportDocument('pdf')}
            disabled={blocked || !pdfReady}
          >
            <Printer data-icon='inline-start' />
            导出 PDF
          </Button>
          <Button
            variant={errors.length ? 'destructive' : 'default'}
            onClick={() => exportDocument('word')}
            disabled={blocked || !wordReady}
          >
            <FileText data-icon='inline-start' />
            导出 Word
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
