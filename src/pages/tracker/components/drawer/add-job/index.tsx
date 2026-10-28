import type { ComponentProps } from 'react'
import type { AddJobFormData } from './types'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { DURATION, EASE } from '@/lib/motion'
import { createCompany } from '@/lib/supabase/resume'
import { extractJobProfile } from '@/lib/supabase/resume/job-profile'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG } from '../../../const'
import {
  assertTrackerAccountScope,
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import { useTrackerResumeOptions } from '../../../lib/resume-resources'
import useTrackerStore, { getTrackerConflictAction } from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'
import { AddJobForm } from './add-job-form'
import { AddJobStageSection } from './add-job-stage-section'
import { INITIAL_FORM_DATA } from './types'
import { buildJobPayload, validateAddJobForm } from './utils'

export default function AddJobDrawer() {
  const scope = getTrackerAccountScope()

  const { addDrawerOpen, closeAddDrawer, prependJob, referralSourceId } =
    useTrackerStore(
      useShallow((state) => ({
        addDrawerOpen: state.addDrawerOpen,
        closeAddDrawer: state.closeAddDrawer,
        prependJob: state.prependJob,
        referralSourceId: state.referralSourceId,
      })),
    )

  const isMobile = useIsMobile()
  const reduce = useReducedMotion()
  const [formData, setFormData] = useState<AddJobFormData>(INITIAL_FORM_DATA)

  const {
    data: resumes,
    loading: loadingResumes,
    error: resumesError,
    retry: retryResumes,
  } = useTrackerResumeOptions(addDrawerOpen)

  const [submitting, setSubmitting] = useState(false)
  const [pendingTerminal, setPendingTerminal] = useState(false)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const extractRef = useRef<AbortController | null>(null)
  const fieldVersionsRef = useRef<Record<string, number>>({})
  const createButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!addDrawerOpen || !referralSourceId) return

    const source = useTrackerStore
      .getState()
      .jobs.find((job) => job.id === referralSourceId)

    if (source)
      setFormData({
        ...INITIAL_FORM_DATA,
        company: source.company,
        tracker_company_id: source.tracker_company_id,
        referred_from_job_id: source.id,
      })
  }, [addDrawerOpen, referralSourceId])

  useEffect(() => {
    if (!addDrawerOpen) {
      extractRef.current?.abort()
      setExtracting(false)
    }

    return () => extractRef.current?.abort()
  }, [addDrawerOpen, scope])

  const handleChange = (field: keyof AddJobFormData, value: string) => {
    fieldVersionsRef.current[field] = (fieldVersionsRef.current[field] ?? 0) + 1

    if (field === 'jd_text') {
      extractRef.current?.abort()
      setExtracting(false)
    }

    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const extract = async () => {
    extractRef.current?.abort()

    const controller = new AbortController()
    const versions = { ...fieldVersionsRef.current }

    extractRef.current = controller
    setExtracting(true)
    setExtractError(null)

    try {
      const profile = await extractJobProfile(
        formData.jd_text,
        controller.signal,
      )

      if (controller.signal.aborted || !isTrackerAccountScopeCurrent(scope))
        return

      setFormData((current) => {
        const next = { ...current }

        for (const field of [
          'company',
          'position',
          'location',
          'source',
        ] as const) {
          if (
            profile[field] &&
            (field !== 'company' || current.tracker_company_id === null) &&
            fieldVersionsRef.current[field] === versions[field]
          )
            next[field] = profile[field]
        }

        const salary = profile.salary?.match(
          /^(\d+(?:\.\d+)?)\s*[kK](?:\s*[-~～至]\s*(\d+(?:\.\d+)?)\s*[kK])?/,
        )

        if (salary && fieldVersionsRef.current.salaryMin === versions.salaryMin)
          next.salaryMin = salary[1]
        if (
          salary?.[2] &&
          fieldVersionsRef.current.salaryMax === versions.salaryMax
        )
          next.salaryMax = salary[2]

        return next
      })
    } catch (error) {
      if (!controller.signal.aborted && isTrackerAccountScopeCurrent(scope))
        setExtractError(getTrackerErrorMessage(error))
    } finally {
      if (
        extractRef.current === controller &&
        isTrackerAccountScopeCurrent(scope)
      )
        setExtracting(false)
    }
  }

  const handleResumeChange = (resumeId: string | null) => {
    setFormData((prev) => ({ ...prev, resume_id: resumeId }))
  }

  const handleCompanyChange = (id: string | null, name: string) => {
    fieldVersionsRef.current.company =
      (fieldVersionsRef.current.company ?? 0) + 1

    setFormData((current) => ({
      ...current,
      tracker_company_id: id,
      company: name,
    }))
  }

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA)
  }

  const submitJob = async () => {
    setSubmitting(true)

    try {
      assertTrackerAccountScope(scope)

      const newJob = await createCompany(
        buildJobPayload({
          ...formData,
          status: formData.status === 'applied' ? 'saved' : formData.status,
        }),
        createTrackerAccountGuard(scope),
      )

      prependJob(newJob, scope)
      closeAddDrawer()
      toast.success('添加成功')
      resetForm()

      if (formData.status === 'applied') {
        useTrackerStore.getState().openJobDrawer(newJob)
        useTrackerStore.getState().requestSubmission(newJob.id)
      }
    } catch (error) {
      if (!isTrackerAccountScopeCurrent(scope)) return

      console.error('Failed to add job:', error)

      toast.error('添加失败', {
        description: getTrackerErrorMessage(error),
        action: getTrackerConflictAction(error, closeAddDrawer),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateAddJobForm(formData)) {
      const missingField = (['position', 'company'] as const).find(
        (field) => !formData[field].trim(),
      )

      if (missingField)
        document
          .getElementById(
            missingField === 'company' && formData.tracker_company_id === null
              ? 'company-new'
              : missingField,
          )
          ?.focus()

      return
    }

    const duplicate = useTrackerStore
      .getState()
      .jobs.find(
        (job) =>
          job.tracker_company_id === formData.tracker_company_id &&
          (job.recruitment_batch ?? '').trim() ===
            formData.recruitment_batch.trim() &&
          job.position.trim().toLocaleLowerCase() ===
            formData.position.trim().toLocaleLowerCase(),
      )

    if (duplicate) {
      setDuplicateId(duplicate.id)

      return
    }

    if (formData.status === 'offer' || formData.status === 'rejected') {
      setPendingTerminal(true)

      return
    }

    await submitJob()
  }

  const handleCancel = () => {
    resetForm()
    closeAddDrawer()
  }

  const handleOpenChange = (
    open: boolean,
    details?: Parameters<
      NonNullable<ComponentProps<typeof Drawer>['onOpenChange']>
    >[1],
  ) => {
    // 手机端 Base UI 抽屉不在 Radix 确认框的浮层树里；取消确认不能关闭表单。
    if (
      !open &&
      (pendingTerminal ||
        duplicateId !== null ||
        (details?.reason === 'escape-key' &&
          details.event.target instanceof Element &&
          details.event.target.closest(
            '[role="alertdialog"], [role="listbox"], [data-slot="popover-content"]',
          )))
    ) {
      details?.cancel()

      return
    }
    if (!open) handleCancel()
  }

  const fields = (
    <AddJobForm
      formData={formData}
      onChange={handleChange}
      onCompanyChange={handleCompanyChange}
    >
      <div className='space-y-2'>
        <Button
          type='button'
          variant='outline'
          disabled={extracting || !formData.jd_text.trim()}
          onClick={extract}
        >
          {extracting ? '正在提取…' : '提取岗位'}
        </Button>
        {extractError && (
          <p role='alert' className='text-sm text-destructive'>
            {extractError}
          </p>
        )}
      </div>
      <AddJobStageSection
        formData={formData}
        onChange={handleChange}
        onResumeChange={handleResumeChange}
        resumes={resumes ?? []}
        loadingResumes={loadingResumes}
      />
      <AnimatePresence initial={false}>
        {resumesError && (
          <motion.div
            role='alert'
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              transition: {
                duration: reduce ? 0 : DURATION.fast,
                ease: EASE.in,
              },
            }}
            transition={{
              duration: reduce ? 0 : DURATION.base,
              ease: EASE.out,
            }}
            className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'
          >
            <span>
              简历列表加载失败：
              {resumesError}
            </span>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={retryResumes}
            >
              重试列表
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </AddJobForm>
  )

  const actions = (
    <>
      <Button
        variant='outline'
        className={cn(isMobile && 'h-11 w-full')}
        onClick={handleCancel}
        disabled={submitting}
      >
        取消
      </Button>
      <Button
        ref={createButtonRef}
        className={cn(isMobile && 'h-11 w-full')}
        onClick={() => handleSubmit()}
        disabled={submitting}
      >
        {submitting ? '提交中...' : '创建职位'}
      </Button>
    </>
  )

  return (
    <>
      {isMobile ? (
        <Drawer
          open={addDrawerOpen}
          onOpenChange={handleOpenChange}
          showSwipeHandle
        >
          <DrawerContent className='max-h-[calc(100dvh-1rem)] overflow-clip'>
            <DrawerHeader>
              <DrawerTitle>新增职位</DrawerTitle>
              <DrawerDescription className='sr-only'>
                填写职位和公司信息。
              </DrawerDescription>
            </DrawerHeader>
            <div className='min-h-0 flex-1 overflow-y-auto px-4 py-5'>
              {fields}
            </div>
            <DrawerFooter className='grid grid-cols-2 gap-3 border-t bg-background pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]'>
              {actions}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={addDrawerOpen} onOpenChange={handleOpenChange}>
          <DialogContent className='max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-lg'>
            <DialogHeader>
              <DialogTitle>新增职位</DialogTitle>
              <DialogDescription className='sr-only'>
                填写职位和公司信息。
              </DialogDescription>
            </DialogHeader>
            <div className='-mx-1 min-h-0 overflow-y-auto px-1'>{fields}</div>
            <DialogFooter>{actions}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <AlertDialog open={pendingTerminal} onOpenChange={setPendingTerminal}>
        <AlertDialogContent
          size='sm'
          onCloseAutoFocus={(event) => {
            event.preventDefault()

            if (
              useTrackerStore.getState().addDrawerOpen &&
              !createButtonRef.current?.disabled
            )
              createButtonRef.current?.focus({ preventScroll: true })
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>确认新增终态职位？</AlertDialogTitle>
            <AlertDialogDescription>
              将以「
              {APPLICATION_STATUS_CONFIG[formData.status].label}
              」创建该职位。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPendingTerminal(false)
                submitJob()
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={duplicateId !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicateId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>已有同名岗位</AlertDialogTitle>
            <AlertDialogDescription>
              同一公司和职位已存在。可以继续跟进已有岗位，或明确创建新的招聘批次。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回修改</AlertDialogCancel>
            <Button
              variant='outline'
              onClick={() => {
                const existing = useTrackerStore
                  .getState()
                  .jobs.find((job) => job.id === duplicateId)

                setDuplicateId(null)
                closeAddDrawer()

                if (existing) useTrackerStore.getState().openJobDrawer(existing)
              }}
            >
              打开已有岗位
            </Button>
            <AlertDialogAction
              onClick={() => {
                setDuplicateId(null)

                if (
                  formData.status === 'offer' ||
                  formData.status === 'rejected'
                )
                  setPendingTerminal(true)
                else submitJob()
              }}
            >
              继续新建批次
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
