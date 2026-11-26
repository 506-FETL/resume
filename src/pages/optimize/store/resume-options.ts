import type { StoreApi } from 'zustand'
import type { AtsResumeLabel } from '@/lib/supabase/resume/ats'
import { getErrorMessage } from '@/utils/error'
import {
  readAtsResumePage,
  readSelectedResumeOption,
  readMissingOptionScores,
  type AtsResumeOption,
  type OptionScore,
  type ResumeSource,
} from './picker-queries'

interface OptionPage {
  items: AtsResumeOption[]
  ready: boolean
  loading: boolean
  error: string | null
  hasMore: boolean
}

const emptyPage: OptionPage = {
  items: [],
  ready: false,
  loading: false,
  error: null,
  hasMore: false,
}

interface ResumeOptionsState {
  resumePages: Record<ResumeSource, OptionPage>
  selectedResumeId: string | null
  selectedResumeOption: AtsResumeLabel | null
  resumeOptionsRevision: number
  selectedResumeRevision: number
  optionScoresLoading: boolean
  reconcileOptionReport: (item: AtsResumeOption) => void
}

export function createAtsResumeOptions(
  set: StoreApi<ResumeOptionsState>['setState'],
  get: StoreApi<ResumeOptionsState>['getState'],
) {
  const requests = new Map<ResumeSource, Promise<void>>()

  const savedScores = new Map<
    string,
    { score: OptionScore; revision: number }
  >()

  let scoreRevision = 0
  let selectedRequest: { id: string; promise: Promise<void> } | null = null
  let scoresRequest: Promise<void> | null = null

  const setPage = (source: ResumeSource, patch: Partial<OptionPage>) =>
    set((state) => ({
      resumePages: {
        ...state.resumePages,
        [source]: { ...state.resumePages[source], ...patch },
      },
    }))

  const findResumeOption = (id: string, source: ResumeSource) => {
    const page = get().resumePages[source]

    return page.ready
      ? page.items.find((item) => item.resume_id === id)
      : undefined
  }

  const loadResumePage = (
    source: ResumeSource,
    owner: string | null,
    more = false,
  ): Promise<void> => {
    const pending = requests.get(source)

    if (pending) return pending

    const page = get().resumePages[source]

    if (page.ready && (!more || !page.hasMore)) return Promise.resolve()

    const offset = page.ready ? page.items.length : 0
    const queryRevision = scoreRevision

    setPage(source, { loading: true, error: null })

    const task = readAtsResumePage(source, owner, offset)
      .then(({ items, hasMore }) => {
        if (requests.get(source) !== task) return

        const previous = offset ? get().resumePages[source].items : []

        const merged = [
          ...previous,
          ...items.map((item) => {
            const saved = savedScores.get(item.resume_id)

            return saved &&
              (saved.revision > queryRevision || item.report === undefined)
              ? { ...item, report: saved.score }
              : item
          }),
        ]

        setPage(source, { items: merged, hasMore, loading: false, ready: true })

        const selected = merged.find(
          (item) => item.resume_id === get().selectedResumeId,
        )

        if (selected) {
          set({ selectedResumeOption: selected })

          if (source === 'online') get().reconcileOptionReport(selected)
        }
      })
      .catch((error) => {
        if (requests.get(source) === task)
          setPage(source, {
            loading: false,
            error: getErrorMessage(error, '简历列表加载失败'),
          })
      })
      .finally(() => {
        if (requests.get(source) === task) requests.delete(source)
      })

    requests.set(source, task)

    return task
  }

  const retryOptionScores = (owner: string) => {
    if (scoresRequest) return scoresRequest

    const ids = get()
      .resumePages.online.items.filter((item) => item.report === undefined)
      .map((item) => item.resume_id)

    if (!ids.length) return Promise.resolve()

    set({ optionScoresLoading: true })

    const task = Promise.resolve()
      .then(async () => {
        // 每个失败页单独重试，避免超长 URL 或超过 PostgREST 行数上限。
        for (let i = 0; i < ids.length; i += 10) {
          const batch = ids.slice(i, i + 10)
          const scores = await readMissingOptionScores(owner, batch)

          if (scoresRequest !== task) return

          setPage('online', {
            items: get().resumePages.online.items.map((item) =>
              item.report === undefined && batch.includes(item.resume_id)
                ? { ...item, report: scores.get(item.resume_id) ?? null }
                : item,
            ),
          })
        }

        const selected = findResumeOption(
          get().selectedResumeId ?? '',
          'online',
        )

        if (selected) get().reconcileOptionReport(selected)
      })
      .catch(() => {
        // 未读到的检测状态继续保留为未知，界面仍可重试。
      })
      .finally(() => {
        if (scoresRequest !== task) return

        scoresRequest = null
        set({ optionScoresLoading: false })
      })

    scoresRequest = task

    return task
  }

  const invalidateResumeOptions = (id?: string, confirmed?: AtsResumeLabel) => {
    const sources: ResumeSource[] = id
      ? [id.startsWith('local-') ? 'offline' : 'online']
      : ['online', 'offline']

    for (const source of sources) {
      requests.delete(source)
      setPage(source, { ready: false, loading: false, error: null })
    }

    if (sources.includes('online')) {
      scoresRequest = null
      set({ optionScoresLoading: false })
    }

    const affectsSelected = !id || id === get().selectedResumeId

    const label =
      affectsSelected && confirmed?.resume_id === id ? confirmed : undefined

    if (affectsSelected) selectedRequest = null

    set((state) => ({
      resumeOptionsRevision: state.resumeOptionsRevision + 1,
      ...(label ? { selectedResumeOption: label } : {}),
      selectedResumeRevision:
        state.selectedResumeRevision + Number(affectsSelected && !label),
    }))
  }

  return {
    resumePages: { online: emptyPage, offline: emptyPage },
    selectedResumeOption: null as AtsResumeLabel | null,
    resumeOptionsRevision: 0,
    selectedResumeRevision: 0,
    optionScoresLoading: false,
    findResumeOption,
    loadResumePage,
    retryOptionScores,
    loadSelectedResumeOption: (
      id: string,
      source: ResumeSource,
      owner: string | null,
    ) => {
      const known = findResumeOption(id, source)

      if (known) {
        set({ selectedResumeOption: known })

        return Promise.resolve()
      }
      if (selectedRequest?.id === id) return selectedRequest.promise

      const promise = readSelectedResumeOption(id, source, owner)
        .then((option) => {
          if (
            selectedRequest?.promise === promise &&
            get().selectedResumeId === id
          )
            set({ selectedResumeOption: option })
        })
        .catch(() => {
          // 打开选择框仍可重新读取名称；当前报告与工具不依赖这次读取。
        })
        .finally(() => {
          if (selectedRequest?.promise === promise) selectedRequest = null
        })

      selectedRequest = { id, promise }

      return promise
    },
    rememberOptionScore: (id: string, score: OptionScore) => {
      savedScores.set(id, { score, revision: ++scoreRevision })

      const { items } = get().resumePages.online

      if (items.some((item) => item.resume_id === id))
        setPage('online', {
          items: items.map((item) =>
            item.resume_id === id ? { ...item, report: score } : item,
          ),
        })
    },
    startResumeOptionVisit: () => {
      requests.clear()
      savedScores.clear()
      scoresRequest = null

      set({
        resumePages: { online: emptyPage, offline: emptyPage },
        optionScoresLoading: false,
      })
    },
    invalidateResumeOptions,
    resetResumeOptions: () => {
      requests.clear()
      savedScores.clear()
      scoresRequest = null
      selectedRequest = null

      set((state) => ({
        resumePages: { online: emptyPage, offline: emptyPage },
        selectedResumeOption: null,
        optionScoresLoading: false,
        selectedResumeRevision: state.selectedResumeRevision + 1,
      }))
    },
  }
}
