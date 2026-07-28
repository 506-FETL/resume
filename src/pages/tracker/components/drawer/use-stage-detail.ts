import type { ApplicationStatus, InterviewSubStage, StageDetail, StageStatus } from '../../types'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { updateCompany } from '@/lib/supabase/resume'
import { APPLICATION_STATUS_ORDER, DEFAULT_INTERVIEW_SUB_STAGES } from '../../const'
import useTrackerStore from '../../store'
import { appendStatusChangeActivity, getTrackerErrorMessage } from '../../utils'

interface UseStageDetailProps {
  displayStage: ApplicationStatus
}

export function useStageDetail({ displayStage }: UseStageDetailProps) {
  const { selectedJob: job, syncJob } = useTrackerStore()

  // Local state
  const [localDetails, setLocalDetails] = useState<StageDetail[]>(job?.stage_details || [])
  const [localSubStages, setLocalSubStages] = useState<InterviewSubStage[]>(() => job?.interview_sub_stages || [])
  const [isDirty, setIsDirty] = useState(false)
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [openSubStages, setOpenSubStages] = useState<Set<string>>(() => new Set())
  const [saving, setSaving] = useState(false)

  // Reset local state when job changes
  useEffect(() => {
    setLocalDetails(job?.stage_details || [])
    setLocalSubStages(job?.interview_sub_stages || [])
    setIsDirty(false)
  }, [job?.id, job?.status, job?.stage_details, job?.interview_sub_stages])

  const isInterviewStatus = displayStage === 'interview'

  // Current stage detail
  const currentStageDetail = localDetails.find(s => s.stage === displayStage)
  const currentStatus = currentStageDetail?.status || '待处理'

  // Check if there are changes
  const checkDirty = () => {
    const detailsChanged = JSON.stringify(job?.stage_details) !== JSON.stringify(localDetails)
    const subStagesChanged = JSON.stringify(job?.interview_sub_stages || []) !== JSON.stringify(localSubStages)
    return detailsChanged || subStagesChanged
  }

  const markDirty = () => setIsDirty(checkDirty())

  // Update current stage detail
  const updateStageDetail = (updates: Partial<typeof currentStageDetail>) => {
    setLocalDetails((prev) => {
      const exists = prev.find(s => s.stage === displayStage)
      if (exists) {
        return prev.map(s => s.stage === displayStage ? { ...s, ...updates } : s)
      }
      return [...prev, { stage: displayStage, status: '待处理' as const, start_date: null, notes: '', ...updates }]
    })
    // Set dirty directly because setLocalDetails is async
    setIsDirty(true)
  }

  const handleStatusChange = (newStatus: StageStatus) => {
    if (newStatus === '已拒绝') {
      const rejectedDetails = localDetails.map(s => ({ ...s, status: '已拒绝' as const }))
      setLocalDetails(rejectedDetails)
      setIsStatusOpen(false)
      setIsDirty(true)
      return
    }

    // Validation when selecting '已完成'
    if (newStatus === '已完成') {
      if (isInterviewStatus) {
        // Interview stage: all interview rounds must be completed
        const savedSubStages = job?.interview_sub_stages || []
        const allCompleted = savedSubStages.length > 0
          && savedSubStages.every(s => s.status === '已完成')
        if (!allCompleted) {
          toast.warning('请先完成当前的面试')
          setIsStatusOpen(false)
          return
        }
      }
      else {
        // Non-interview stage: start date cannot be empty
        const detail = localDetails.find(s => s.stage === displayStage)
        if (!detail?.start_date) {
          toast.warning('请先选择开始时间，保存完成后，才能选择已完成状态')
          setIsStatusOpen(false)
          return
        }
      }
    }

    updateStageDetail({ status: newStatus })
    setIsStatusOpen(false)
  }

  const handleDateChange = (date: Date | undefined) => {
    const dateStr = date ? dayjs(date).format('YYYY-MM-DD') : null
    updateStageDetail({ start_date: dateStr })
  }

  // Interview sub-stage operations
  const addSubStage = () => {
    const newSubStage: InterviewSubStage = {
      id: crypto.randomUUID(),
      label: `${DEFAULT_INTERVIEW_SUB_STAGES[localSubStages.length % DEFAULT_INTERVIEW_SUB_STAGES.length]}`,
      status: '待处理',
      start_date: null,
      notes: '',
      order: localSubStages.length,
    }
    setLocalSubStages([...localSubStages, newSubStage])
    setOpenSubStages(prev => new Set(prev).add(newSubStage.id))
    markDirty()
  }

  const deleteSubStage = (id: string) => {
    setLocalSubStages(prev => prev.filter(s => s.id !== id).map((s, idx) => ({ ...s, order: idx })))
    setOpenSubStages((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    markDirty()
  }

  const updateSubStage = (id: string, updates: Partial<InterviewSubStage>) => {
    // Sub-stage rejection status propagation
    if (updates.status === '已拒绝') {
      const rejectedDetails = localDetails.map(s => ({ ...s, status: '已拒绝' as const }))
      const rejectedSubStages = localSubStages.map(s => ({ ...s, status: '已拒绝' as const }))
      setLocalDetails(rejectedDetails)
      setLocalSubStages(rejectedSubStages)
      setIsDirty(true)
      return
    }

    setLocalSubStages(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    setIsDirty(true)
  }

  const toggleSubStage = (id: string) => {
    setOpenSubStages((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      }
      else {
        next.add(id)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!job)
      return

    let payload: Partial<typeof job>

    // Check if current stage is marked "已完成", if so auto-advance to next stage
    const currentDetail = localDetails.find(s => s.stage === displayStage)
    if (currentDetail?.status === '已完成' && displayStage === job.status) {
      const currentIdx = APPLICATION_STATUS_ORDER.indexOf(job.status)
      const nextStatus = APPLICATION_STATUS_ORDER[currentIdx + 1]

      if (nextStatus) {
        // Ensure next stage detail exists
        const hasNext = localDetails.find(s => s.stage === nextStatus)
        const finalDetails = hasNext
          ? localDetails
          : [...localDetails, { stage: nextStatus, status: '待处理' as const, start_date: null, notes: '' }]

        payload = {
          status: nextStatus,
          stage_details: finalDetails,
          interview_sub_stages: localSubStages,
          activities: appendStatusChangeActivity(job, nextStatus),
        }
      }
      else {
        payload = {
          stage_details: localDetails,
          interview_sub_stages: localSubStages,
        }
      }
    }
    else {
      payload = {
        stage_details: localDetails,
        interview_sub_stages: localSubStages,
      }
    }

    setSaving(true)

    try {
      const savedJob = await updateCompany(job.id, payload)

      syncJob(savedJob)
      setIsDirty(false)
      setOpenSubStages(new Set())
    }
    catch (error) {
      console.error('Failed to update stage detail:', error)
      toast.error('保存失败', { description: getTrackerErrorMessage(error) })
    }
    finally {
      setSaving(false)
    }
  }

  const canCompleteStage = (() => {
    if (!job)
      return false
    if (currentStatus === '已完成' || currentStatus === '已拒绝')
      return false
    if (isInterviewStatus) {
      const savedSubStages = job.interview_sub_stages || []
      return savedSubStages.length > 0 && savedSubStages.every(s => s.status === '已完成')
    }
    const detail = localDetails.find(s => s.stage === displayStage)
    return Boolean(detail?.start_date)
  })()

  const markCurrentStageComplete = async () => {
    if (!job || !canCompleteStage)
      return

    const nextDetails = (() => {
      const existing = localDetails.find(s => s.stage === displayStage)
      if (existing) {
        return localDetails.map(s => s.stage === displayStage ? { ...s, status: '已完成' as const } : s)
      }
      return [...localDetails, { stage: displayStage, status: '已完成' as const, start_date: null, notes: '' }]
    })()

    let payload: Partial<typeof job>
    if (displayStage === job.status) {
      const currentIdx = APPLICATION_STATUS_ORDER.indexOf(job.status)
      const nextStatus = APPLICATION_STATUS_ORDER[currentIdx + 1]
      if (nextStatus) {
        const hasNext = nextDetails.find(s => s.stage === nextStatus)
        const finalDetails = hasNext
          ? nextDetails
          : [...nextDetails, { stage: nextStatus, status: '待处理' as const, start_date: null, notes: '' }]
        payload = {
          status: nextStatus,
          stage_details: finalDetails,
          interview_sub_stages: localSubStages,
          activities: appendStatusChangeActivity(job, nextStatus),
        }
      }
      else {
        payload = { stage_details: nextDetails, interview_sub_stages: localSubStages }
      }
    }
    else {
      payload = { stage_details: nextDetails, interview_sub_stages: localSubStages }
    }

    setSaving(true)
    try {
      const savedJob = await updateCompany(job.id, payload)
      syncJob(savedJob)
      setIsDirty(false)
    }
    catch (error) {
      console.error('Failed to complete stage:', error)
      toast.error('保存失败', { description: getTrackerErrorMessage(error) })
    }
    finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setLocalDetails(job?.stage_details || [])
    setLocalSubStages(job?.interview_sub_stages || [])
    setIsDirty(false)
    setOpenSubStages(new Set())
  }

  const selectedDate = currentStageDetail?.start_date
    ? dayjs(currentStageDetail.start_date).toDate()
    : undefined

  return {
    job,
    localDetails,
    localSubStages,
    isDirty,
    isStatusOpen,
    setIsStatusOpen,
    openSubStages,
    saving,
    isInterviewStatus,
    currentStageDetail,
    currentStatus,
    selectedDate,
    updateStageDetail,
    handleStatusChange,
    handleDateChange,
    addSubStage,
    deleteSubStage,
    updateSubStage,
    toggleSubStage,
    handleSave,
    handleCancel,
    canCompleteStage,
    markCurrentStageComplete,
  }
}
