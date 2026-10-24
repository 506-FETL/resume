import type { ComponentProps } from 'react'
import type { AddJobFormData } from './types'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
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
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_CONFIG } from '../../../const'
import {
  assertTrackerAccountScope,
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import { useTrackerResumeOptions } from '../../../lib/resume-resources'
import useTrackerStore from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'
import { AddJobForm } from './add-job-form'
import { AddJobStageSection } from './add-job-stage-section'
import { INITIAL_FORM_DATA } from './types'
import { buildJobPayload, validateAddJobForm } from './utils'

export default function AddJobDrawer() {
  const scope = getTrackerAccountScope()
  const { addDrawerOpen, closeAddDrawer, prependJob } = useTrackerStore(
    useShallow((state) => ({
      addDrawerOpen: state.addDrawerOpen,
      closeAddDrawer: state.closeAddDrawer,
      prependJob: state.prependJob,
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
  const createButtonRef = useRef<HTMLButtonElement>(null)

  const handleChange = (field: keyof AddJobFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleResumeChange = (resumeId: string | null) => {
    setFormData((prev) => ({ ...prev, resume_id: resumeId }))
  }

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA)
  }

  const submitJob = async () => {
    setSubmitting(true)

    try {
      assertTrackerAccountScope(scope)
      const newJob = await createCompany(
        buildJobPayload(formData),
        createTrackerAccountGuard(scope),
      )
      prependJob(newJob, scope)
      closeAddDrawer()
      toast.success('添加成功')
      resetForm()
    } catch (error) {
      if (!isTrackerAccountScopeCurrent(scope)) return
      console.error('Failed to add job:', error)
      toast.error('添加失败', { description: getTrackerErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateAddJobForm(formData)) {
      const missingField = (['position', 'company', 'location'] as const).find(
        (field) => !formData[field].trim(),
      )
      if (missingField) document.getElementById(missingField)?.focus()
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
    <AddJobForm formData={formData} onChange={handleChange}>
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
    </>
  )
}
