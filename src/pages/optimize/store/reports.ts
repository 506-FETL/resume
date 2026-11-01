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

  const selectReport = async () => {
    const requestId = ++selectionRequest
    const scope = generation
    const { selectedResumeId, atsConfigs } = get()

    const summary = selectedResumeId
      ? atsConfigs?.find((row) => row.resume_id === selectedResumeId)
      : atsConfigs?.[0]

    if (!summary) {
      set({ currentAtsConfig: null, loading: false, loadError: null })

      return
    }

    const cached = reports.get(summary.id)

    if (cached) {
      set({ currentAtsConfig: cached, loading: false, loadError: null })

      return
    }

    set({ currentAtsConfig: null, loading: true, loadError: null })

    try {
      const report = await readReport(summary.id)

      if (scope === generation && requestId === selectionRequest)
        set({ currentAtsConfig: report, loading: false })
    } catch (error) {
      if (scope === generation && requestId === selectionRequest)
        set({
          loading: false,
          loadError: getErrorMessage(error, '报告加载失败，请重试'),
        })
    }
  }

  const acceptReport = (report: AtsEvaluationResult) => {
    const normalized = {
      ...report,
      findings: ensureAtsFindingsHaveSuggestions(report.findings),
    }

    summaryRevision += 1
    reports.set(report.id, normalized)

    set((state) => ({
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

      const scope = generation
      const summaryVersion = summaryRevision

      if (force) {
        reportRevision += 1
        selectionRequest += 1
        reports.clear()
        requests.clear()
      }

      set({
        loadError: null,
        loading: get().atsConfigs === null || get().loading,
      })

      const request = (async () => {
        try {
          const [summaries, initialReport] = await Promise.all([
            listLatestAtsReportSummaries(),
            get().atsConfigs === null || force
              ? getLatestAtsReport(get().selectedResumeId)
              : null,
          ])

          if (scope !== generation || summaryVersion !== summaryRevision) return

          if (initialReport)
            reports.set(initialReport.id, {
              ...initialReport,
              findings: ensureAtsFindingsHaveSuggestions(
                initialReport.findings,
              ),
            })

          const ids = new Set(summaries.map((row) => row.id))

          for (const id of reports.keys()) {
            if (!ids.has(id)) reports.delete(id)
          }

          set({ atsConfigs: summaries })
          await selectReport()
        } catch (error) {
          if (scope !== generation || summaryVersion !== summaryRevision) return

          set({
            loading: false,
            loadError: getErrorMessage(error, '报告加载失败，请重试'),
          })
        }
      })().finally(() => {
        if (initRequest === request) initRequest = null
      })

      initRequest = request

      return request
    },
    setSelectedResume: (id: string, type: 'online' | 'offline') => {
      set({
        selectedResumeId: id,
        selectedResumeType: type,
        analysisError: null,
      })

      if (get().atsConfigs !== null) selectReport()
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
      reports.clear()
      requests.clear()

      set({
        atsConfigs: null,
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
