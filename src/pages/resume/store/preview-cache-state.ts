import type {
  PrepareResumePreview,
  RenderResumePreview,
  ResumePreviewEntry,
  ResumePreviewRequest,
} from './preview-types'
import { create } from 'zustand'
import { releasePreviewPaper, resumePreviewKey } from './preview-types'

const MAX_PREVIEWS = 40
const MAX_PREVIEW_BYTES = 32 * 1024 * 1024
const MAX_PENDING_PREVIEWS = 2

interface PreviewJob {
  key: string
  entry: ResumePreviewEntry
  controller: AbortController
  render?: RenderResumePreview
}

interface ResumePreviewStore {
  accountId: string | null
  entries: Record<string, ResumePreviewEntry>
  acquire: (request: ResumePreviewRequest) => () => void
  retry: (key: string) => void
  resetAccount: (accountId: string | null) => void
}

export function createResumePreviewStore(
  prepare: PrepareResumePreview,
  accountId: string | null = null,
) {
  const consumers = new Map<string, number>()
  const recent = new Set<string>()
  const latest = new Map<string, string>()
  const jobs = new Map<string, PreviewJob>()
  let active: PreviewJob | null = null
  let accountGeneration = 0

  return create<ResumePreviewStore>((set, get) => {
    function remove(entries: Record<string, ResumePreviewEntry>, key: string) {
      const entry = entries[key]

      if (entry?.status === 'ready') releasePreviewPaper(entry.paper)

      delete entries[key]
      recent.delete(key)

      if (entry && latest.get(entry.request.resumeId) === key)
        latest.delete(entry.request.resumeId)
    }

    function prune() {
      const entries = { ...get().entries }
      let count = Object.keys(entries).length

      let bytes = Object.values(entries).reduce(
        (total, entry) =>
          total + (entry.status === 'ready' ? entry.paper.bytes : 0),
        0,
      )

      for (const key of recent) {
        const entry = entries[key]

        if (consumers.has(key) || jobs.has(key)) continue

        const superseded = latest.get(entry.request.resumeId) !== key

        if (!superseded && count <= MAX_PREVIEWS && bytes <= MAX_PREVIEW_BYTES)
          continue

        bytes -= entry.status === 'ready' ? entry.paper.bytes : 0
        count -= 1
        remove(entries, key)
      }

      set({ entries })
    }

    function finish(job: PreviewJob) {
      if (jobs.get(job.key) !== job) return

      jobs.delete(job.key)

      if (active === job) active = null

      prune()
      pump()
    }

    function renderNext() {
      if (active) return

      const job = [...jobs.values()].find(
        (candidate) => candidate.render && consumers.has(candidate.key),
      )

      if (!job?.render) return

      const { key, entry } = job

      active = job

      set((state) => ({
        entries: {
          ...state.entries,
          [key]: { ...entry, status: 'generating' },
        },
      }))

      job
        .render()
        .then((paper) => {
          if (active !== job || job.controller.signal.aborted) {
            releasePreviewPaper(paper)

            return
          }

          set((state) => ({
            entries: {
              ...state.entries,
              [key]: { ...entry, status: 'ready', paper },
            },
          }))
        })
        .catch(() => {
          if (active !== job || job.controller.signal.aborted) return

          set((state) => ({
            entries: { ...state.entries, [key]: { ...entry, status: 'error' } },
          }))
        })
        .finally(() => finish(job))
    }

    function prepareNext(key: string, entry: ResumePreviewEntry) {
      const job: PreviewJob = {
        key,
        entry,
        controller: new AbortController(),
      }

      jobs.set(key, job)

      set((state) => ({
        entries: {
          ...state.entries,
          [key]: { ...entry, status: 'preparing' },
        },
      }))

      prepare(entry.request, job.controller.signal, entry.attempt > 0)
        .then((render) => {
          if (jobs.get(key) !== job) return

          if (!consumers.has(key)) {
            const entries = { ...get().entries }

            remove(entries, key)
            set({ entries })
            finish(job)

            return
          }

          job.render = render
          pump()
        })
        .catch(() => {
          if (jobs.get(key) !== job) return

          set((state) => ({
            entries: { ...state.entries, [key]: { ...entry, status: 'error' } },
          }))

          finish(job)
        })
    }

    function pump() {
      renderNext()

      for (const [key, entry] of Object.entries(get().entries)) {
        if (jobs.size >= MAX_PENDING_PREVIEWS) break
        if (entry.status !== 'queued' || !consumers.has(key)) continue

        prepareNext(key, entry)
      }
    }

    return {
      accountId,
      entries: {},
      acquire(request) {
        if (request.accountId !== get().accountId) return () => undefined

        const key = resumePreviewKey(request)
        const generation = accountGeneration

        consumers.set(key, (consumers.get(key) ?? 0) + 1)
        recent.delete(key)
        recent.add(key)
        latest.set(request.resumeId, key)

        if (!get().entries[key]) {
          set((state) => ({
            entries: {
              ...state.entries,
              [key]: { request, attempt: 0, status: 'queued' },
            },
          }))
        }

        prune()
        pump()

        return () => {
          if (generation !== accountGeneration) return

          const remaining = (consumers.get(key) ?? 1) - 1

          if (remaining > 0) consumers.set(key, remaining)
          else consumers.delete(key)

          const job = jobs.get(key)

          if (
            !remaining &&
            (get().entries[key]?.status === 'queued' ||
              (job?.render && active !== job))
          ) {
            const entries = { ...get().entries }

            job?.controller.abort()
            jobs.delete(key)
            remove(entries, key)
            set({ entries })
          }

          prune()
          pump()
        }
      },
      retry(key) {
        const entry = get().entries[key]

        if (entry?.status !== 'error') return

        set((state) => ({
          entries: {
            ...state.entries,
            [key]: { ...entry, attempt: entry.attempt + 1, status: 'queued' },
          },
        }))

        pump()
      },
      resetAccount(nextAccountId) {
        if (nextAccountId === get().accountId) return

        accountGeneration += 1
        jobs.forEach((job) => job.controller.abort())
        jobs.clear()
        active = null

        Object.values(get().entries).forEach((entry) => {
          if (entry.status === 'ready') releasePreviewPaper(entry.paper)
        })

        consumers.clear()
        recent.clear()
        latest.clear()
        set({ accountId: nextAccountId, entries: {} })
      },
    }
  })
}
