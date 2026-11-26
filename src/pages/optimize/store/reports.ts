import type { StoreApi } from 'zustand'
import type { AtsEvaluationResult } from '../types'
import type { AtsResumeLabel } from '@/lib/supabase/resume/ats'
import type { AtsResumeOption, ResumeSource } from './picker-queries'
import type { createAtsResumeOptions } from './resume-options'
import { toast } from 'sonner'
import { ensureAtsFindingsHaveSuggestions } from '@/lib/ats/result/persisted-findings'
import {
  getAtsReport,
  readLatestAtsSelection,
  updateFixChecklist,
} from '@/lib/supabase/resume/ats'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils/error'

export interface AtsReportsState extends Pick<
  ReturnType<typeof createAtsResumeOptions>,
  | 'findResumeOption'
  | 'rememberOptionScore'
  | 'selectedResumeOption'
  | 'selectedResumeRevision'
  | 'loadSelectedResumeOption'
> {
  currentAtsConfig: AtsEvaluationResult | null
  loading: boolean
  loadError: string | null
  selectedResumeId: string | null
  selectedResumeType: ResumeSource | null
  analysisError: string | null
}

interface Selection {
  report: AtsEvaluationResult | null
  resume: AtsResumeLabel | null
}

function normalizeReport(report: AtsEvaluationResult) {
  return {
    ...report,
    findings: ensureAtsFindingsHaveSuggestions(report.findings),
  }
}

export function createAtsReports(
  set: StoreApi<AtsReportsState>['setState'],
  get: StoreApi<AtsReportsState>['getState'],
) {
  let generation = 0
  let selectionRevision = 0
  const reports = new Map<number, AtsEvaluationResult>()
  const requests = new Map<string, Promise<Selection>>()

  let currentRequest: { id: string | null; task: Promise<void> } | null = null

  const select = (
    id: string | null,
    source: ResumeSource | null,
    latest = false,
  ): Promise<void> => {
    if (currentRequest?.id === id) return currentRequest.task

    const revision = ++selectionRevision
    const known = id && source ? get().findResumeOption(id, source) : undefined

    const { currentAtsConfig, selectedResumeOption, selectedResumeRevision } =
      get()

    const selected =
      known ??
      (selectedResumeOption?.resume_id === id ? selectedResumeOption : null)

    const score = latest ? undefined : known?.report
    const cached = score ? reports.get(score.id) : undefined

    const retained =
      !id || currentAtsConfig?.resume_id === id ? currentAtsConfig : null

    currentRequest = null

    set({
      selectedResumeId: id,
      selectedResumeType: source,
      selectedResumeOption: selected,
      currentAtsConfig:
        cached ?? (score === null || source === 'offline' ? null : retained),
      loadError: null,
      analysisError: null,
      loading: !cached && score !== null && source !== 'offline',
    })

    if (source === 'offline' || score === null || cached) {
      if (id && source === 'offline' && !selected)
        return get().loadSelectedResumeOption(
          id,
          source,
          useUserStore.getState().currentUser?.id ?? null,
        )

      return Promise.resolve()
    }

    const key = score ? `report:${score.id}` : `latest:${id ?? ''}`
    let pending = requests.get(key)

    if (!pending) {
      const query = score
        ? getAtsReport(score.id).then((report) => ({
            report,
            resume: selected,
          }))
        : readLatestAtsSelection(id)

      const request = query
        .then(({ report, resume }) => {
          const normalized = report ? normalizeReport(report) : null

          if (normalized && requests.get(key) === request)
            reports.set(normalized.id, normalized)

          return { report: normalized, resume }
        })
        .finally(() => {
          if (requests.get(key) === request) requests.delete(key)
        })

      pending = request
      requests.set(key, request)
    }

    const task = pending
      .then(({ report, resume }) => {
        if (revision !== selectionRevision) return

        const current = get()

        set({
          currentAtsConfig: report,
          ...(resume &&
          selectedResumeRevision === current.selectedResumeRevision &&
          selected === current.selectedResumeOption
            ? { selectedResumeOption: resume }
            : {}),
          loading: false,
          ...(!id && report
            ? {
                selectedResumeId: report.resume_id,
                selectedResumeType: 'online' as const,
              }
            : {}),
        })
      })
      .catch((error) => {
        if (revision === selectionRevision)
          set({
            loading: false,
            loadError: getErrorMessage(error, '报告加载失败，请重试'),
          })
      })
      .finally(() => {
        if (currentRequest?.task === task) currentRequest = null
      })

    currentRequest = { id, task }

    return task
  }

  const acceptReport = (report: AtsEvaluationResult) => {
    const normalized = normalizeReport(report)

    requests.delete(`latest:${report.resume_id}`)
    requests.delete('latest:')
    reports.set(report.id, normalized)

    get().rememberOptionScore(report.resume_id, {
      id: report.id,
      overall_score: report.summary.overall_score,
    })

    if (get().selectedResumeId !== report.resume_id) return

    selectionRevision += 1
    currentRequest = null
    set({ currentAtsConfig: normalized, loading: false, loadError: null })
  }

  const update = <K extends keyof AtsEvaluationResult>(
    key: K,
    value: AtsEvaluationResult[K],
    reportId = get().currentAtsConfig?.id,
  ) => {
    if (reportId === undefined) return

    const visible = get().currentAtsConfig
    const current = visible?.id === reportId ? visible : reports.get(reportId)

    if (!current) return

    const next = { ...current, [key]: value }

    reports.set(reportId, next)

    if (key === 'summary')
      get().rememberOptionScore(current.resume_id, {
        id: reportId,
        overall_score: next.summary.overall_score,
      })
    if (get().currentAtsConfig?.id === reportId) set({ currentAtsConfig: next })
  }

  return {
    init: (force = false, resumeId?: string | null) => {
      if (force) {
        reports.clear()
        requests.clear()
        currentRequest = null
      }

      const { selectedResumeId, selectedResumeType } = get()

      return select(
        resumeId ?? selectedResumeId,
        resumeId ? 'online' : selectedResumeType,
        true,
      )
    },
    reloadCurrentReport: () =>
      select(get().selectedResumeId, get().selectedResumeType, true),
    setSelectedResume: (id: string, type: ResumeSource) => select(id, type),
    selectUploadedResume: (resume: AtsResumeLabel) => {
      selectionRevision += 1
      currentRequest = null

      set({
        selectedResumeId: resume.resume_id,
        selectedResumeType: 'online',
        selectedResumeOption: resume,
        currentAtsConfig: null,
        loading: false,
        loadError: null,
        analysisError: null,
      })
    },
    reconcileOptionReport: (option: AtsResumeOption) => {
      const { selectedResumeId, currentAtsConfig, loading, loadError } = get()

      if (
        loading ||
        loadError ||
        option.report === undefined ||
        option.resume_id !== selectedResumeId
      )
        return
      if ((option.report?.id ?? null) !== (currentAtsConfig?.id ?? null))
        return select(selectedResumeId, 'online')
    },
    acceptReport,
    update,
    revertFixChecklist: async (id: string) => {
      const scope = generation
      const current = get().currentAtsConfig

      if (!current) throw new Error('当前没有 ATS 配置')

      const checklist = current.fixChecklist.map((item) =>
        item.id === id ? { ...item, isDone: !item.isDone } : item,
      )

      update('fixChecklist', checklist, current.id)

      try {
        await updateFixChecklist(checklist, current.id)
      } catch (error) {
        if (scope !== generation) return

        update('fixChecklist', current.fixChecklist, current.id)
        toast.error(getErrorMessage(error, '操作失败'))
      }
    },
    resetReports: () => {
      generation += 1
      selectionRevision += 1
      currentRequest = null
      reports.clear()
      requests.clear()

      set({
        currentAtsConfig: null,
        selectedResumeId: null,
        selectedResumeType: null,
        loading: true,
        loadError: null,
        analysisError: null,
      })
    },
    isReportAccountCurrent: () => {
      const owner = useUserStore.getState().currentUser?.id ?? null
      const scope = generation

      return () =>
        Boolean(owner) &&
        scope === generation &&
        owner === useUserStore.getState().currentUser?.id
    },
  }
}
