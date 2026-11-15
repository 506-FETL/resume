import type { StoreApi } from 'zustand'
import type { AtsEvaluationResult } from '../types'
import type { AtsReportSummary } from '@/lib/supabase/resume/ats'
import { toast } from 'sonner'
import { ensureAtsFindingsHaveSuggestions } from '@/lib/ats'
import {
  getAtsReport,
  getLatestAtsReport,
  listLatestAtsReportSummaries,
  updateFixChecklist,
} from '@/lib/supabase/resume/ats'
import useUserStore from '@/store/user'
import { getErrorMessage } from '@/utils'

export interface AtsReportsState {
  atsConfigs: AtsReportSummary[] | null
  currentAtsConfig: AtsEvaluationResult | null
  loading: boolean
  loadError: string | null
  summariesLoading: boolean
  summariesError: string | null
  selectedResumeId: string | null
  selectedResumeType: 'online' | 'offline' | null
  analysisError: string | null
}

export function createAtsReports(
  set: StoreApi<AtsReportsState>['setState'],
  get: StoreApi<AtsReportsState>['getState'],
) {
  let generation = 0
  let selectionRequest = 0
  let reportRevision = 0
  let summaryRevision = 0
  let initRequest: Promise<void> | null = null
  let summariesRequest: Promise<void> | null = null

  let currentRequest: {
    resumeId: string | null
    promise: Promise<void>
  } | null = null

  const reports = new Map<AtsEvaluationResult['id'], AtsEvaluationResult>()

  const requests = new Map<
    AtsEvaluationResult['id'],
    Promise<AtsEvaluationResult>
  >()

  const readReport = (id: AtsEvaluationResult['id']) => {
    const cached = reports.get(id)

    if (cached) return Promise.resolve(cached)

    const pending = requests.get(id)

    if (pending) return pending

    const scope = generation
    const revision = reportRevision

    const request = getAtsReport(id)
      .then((report) => {
        const normalized = {
          ...report,
          findings: ensureAtsFindingsHaveSuggestions(report.findings),
        }

        if (scope === generation && revision === reportRevision)
          reports.set(id, normalized)

        return normalized
      })
      .finally(() => {
        if (requests.get(id) === request) requests.delete(id)
      })

    requests.set(id, request)

    return request
  }

  const selectReport = (latest = false): Promise<void> => {
    const { selectedResumeId, atsConfigs, currentAtsConfig } = get()

    if (currentRequest?.resumeId === selectedResumeId && !latest)
      return currentRequest.promise

    const requestId = ++selectionRequest
    const scope = generation

    currentRequest = null

    const summary = selectedResumeId
      ? atsConfigs?.find((row) => row.resume_id === selectedResumeId)
      : atsConfigs?.[0]

    if (!summary && atsConfigs !== null && !latest) {
      set({ currentAtsConfig: null, loading: false, loadError: null })

      return Promise.resolve()
    }

    const cached = latest
      ? null
      : summary
        ? reports.get(summary.id)
        : atsConfigs === null &&
            currentAtsConfig &&
            (!selectedResumeId ||
              currentAtsConfig.resume_id === selectedResumeId)
          ? currentAtsConfig
          : null

    if (cached) {
      set({ currentAtsConfig: cached, loading: false, loadError: null })

      return Promise.resolve()
    }

    set({
      currentAtsConfig:
        !selectedResumeId || currentAtsConfig?.resume_id === selectedResumeId
          ? currentAtsConfig
          : null,
      loading: true,
      loadError: null,
    })

    const task = (async () => {
      try {
        const report =
          summary && !latest
            ? await readReport(summary.id)
            : await getLatestAtsReport(selectedResumeId)

        if (scope !== generation || requestId !== selectionRequest) return

        const normalized = report
          ? {
              ...report,
              findings: ensureAtsFindingsHaveSuggestions(report.findings),
            }
          : null

        if (normalized) reports.set(normalized.id, normalized)

        set({ currentAtsConfig: normalized, loading: false })
      } catch (error) {
        if (scope === generation && requestId === selectionRequest)
          set({
            loading: false,
            loadError: getErrorMessage(error, '报告加载失败，请重试'),
          })
      }
    })().finally(() => {
      if (currentRequest?.promise !== task) return

      currentRequest = null

      if (
        scope === generation &&
        requestId === selectionRequest &&
        get().atsConfigs !== atsConfigs
      )
        return reconcileReport()
    })

    currentRequest = { resumeId: selectedResumeId, promise: task }

    return task
  }

  const reconcileReport = () => {
    const { atsConfigs, selectedResumeId, currentAtsConfig, loadError } = get()

    if (atsConfigs === null || currentRequest || loadError) return

    const target = selectedResumeId
      ? atsConfigs.find((row) => row.resume_id === selectedResumeId)
      : atsConfigs[0]

    if ((target?.id ?? null) !== (currentAtsConfig?.id ?? null))
      return selectReport()
  }

  const loadSummaries = (): Promise<void> => {
    if (summariesRequest) return summariesRequest

    const scope = generation
    const revision = summaryRevision

    set({ summariesLoading: true, summariesError: null })

    const task = listLatestAtsReportSummaries()
      .then((summaries) => {
        if (scope !== generation || revision !== summaryRevision) return

        const ids = new Set(summaries.map((row) => row.id))

        for (const id of reports.keys()) {
          if (!ids.has(id)) reports.delete(id)
        }

        set({ atsConfigs: summaries, summariesLoading: false })

        reconcileReport()
      })
      .catch((error: unknown) => {
        if (scope === generation && revision === summaryRevision)
          set({
            summariesLoading: false,
            summariesError: getErrorMessage(error, '检测记录加载失败，请重试'),
          })
      })
      .finally(() => {
        if (summariesRequest === task) summariesRequest = null
      })

    summariesRequest = task

    return task
  }

  const acceptReport = (report: AtsEvaluationResult) => {
    const normalized = {
      ...report,
      findings: ensureAtsFindingsHaveSuggestions(report.findings),
    }

    summaryRevision += 1
    reports.set(report.id, normalized)

    selectionRequest += 1
    currentRequest = null

    set((state) => ({
      summariesLoading: false,
      summariesError: null,
      atsConfigs: [
        {
          id: report.id,
          resume_id: report.resume_id,
          created_at: report.created_at,
          overall_score: report.summary.overall_score,
        },
        ...(state.atsConfigs ?? []).filter(
          (row) => row.resume_id !== report.resume_id,
        ),
      ],
    }))

    selectReport()
  }

  const update = <K extends keyof AtsEvaluationResult>(
    key: K,
    value: AtsEvaluationResult[K],
  ) => {
    const current = get().currentAtsConfig

    if (!current) return

    const next = { ...current, [key]: value }

    reports.set(current.id, next)

    set((state) => ({
      currentAtsConfig: next,
      atsConfigs:
        state.atsConfigs?.map((row) =>
          row.id === current.id
            ? { ...row, overall_score: next.summary.overall_score }
            : row,
        ) ?? null,
    }))
  }

  return {
    init: (force = false): Promise<void> => {
      if (initRequest) return initRequest

      if (force) {
        reportRevision += 1
        selectionRequest += 1
        currentRequest = null
        reports.clear()
        requests.clear()
      }

      const request = Promise.all([loadSummaries(), selectReport(force)])
        .then(() => undefined)
        .finally(() => {
          if (initRequest === request) initRequest = null
        })

      initRequest = request

      return request
    },
    reloadSummaries: loadSummaries,
    reloadCurrentReport: () => selectReport(true),
    setSelectedResume: (id: string, type: 'online' | 'offline') => {
      set({
        selectedResumeId: id,
        selectedResumeType: type,
        analysisError: null,
      })

      selectReport()
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

      update('fixChecklist', checklist)

      try {
        await updateFixChecklist(checklist, current.id)
      } catch (error) {
        if (scope !== generation) return

        reports.set(current.id, current)

        if (get().currentAtsConfig?.id === current.id)
          set({ currentAtsConfig: current })

        toast.error(getErrorMessage(error, '操作失败'))
      }
    },
    resetReports: () => {
      generation += 1
      selectionRequest += 1
      initRequest = null
      summariesRequest = null
      currentRequest = null
      reports.clear()
      requests.clear()

      set({
        atsConfigs: null,
        currentAtsConfig: null,
        selectedResumeId: null,
        selectedResumeType: null,
        loading: true,
        loadError: null,
        summariesLoading: true,
        summariesError: null,
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
