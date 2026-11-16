import type { ComponentProps } from 'react'
import type { AddJobFormData } from './types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import type { Drawer } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { createCompany } from '@/lib/supabase/resume'
import { extractJobProfile } from '@/lib/supabase/resume/job-profile'
import {
  assertTrackerAccountScope,
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../../lib/account-scope'
import { useTrackerResumeOptions } from '../../../lib/resume-resources'
import useTrackerStore, { getTrackerConflictAction } from '../../../store'
import { getTrackerErrorMessage } from '../../../utils'
import { INITIAL_FORM_DATA } from './types'
import { buildJobPayload, validateAddJobForm } from './utils'

export function useAddJob() {
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

  return {
    addDrawerOpen,
    closeAddDrawer,
    isMobile,
    reduce,
    formData,
    resumes,
    loadingResumes,
    resumesError,
    retryResumes,
    submitting,
    pendingTerminal,
    setPendingTerminal,
    duplicateId,
    setDuplicateId,
    extracting,
    extractError,
    createButtonRef,
    handleChange,
    extract,
    handleResumeChange,
    handleCompanyChange,
    submitJob,
    handleSubmit,
    handleCancel,
    handleOpenChange,
  }
}
