import { create } from 'zustand'
import { getDashboardOfflineResumes } from '@/lib/offline-resume-manager/dashboard'
import useUserStore from '@/store/user'
import type { Resume } from './types'

type ResumeSource = 'cloud' | 'local'

interface ResumeResource {
  items: Resume[]
  total: number
  loading: boolean
  error: string | null
  hasLoaded: boolean
}

interface IndexStore {
  accountId: string | null
  cloud: ResumeResource
  local: ResumeResource
  loadData: () => Promise<void>
  leavePage: () => void
  retrySource: (source: ResumeSource) => Promise<void>
}

const initialResource: ResumeResource = {
  items: [],
  total: 0,
  loading: true,
  error: null,
  hasLoaded: false,
}

const pending = new Map<ResumeSource, Promise<void>>()

let pageOpen = false

const useIndexStore = create<IndexStore>()((set, get) => {
  const loadSource = (source: ResumeSource) => {
    if (useUserStore.getState().authStatus === 'unknown')
      return Promise.resolve()

    const existing = pending.get(source)

    if (existing) return existing

    const { accountId } = get()

    const task = readSource(source, accountId)
      .then((result) => {
        if (pending.get(source) === task)
          set({
            [source]: {
              ...result,
              loading: false,
              error: null,
              hasLoaded: true,
            },
          })
      })
      .catch(() => {
        if (pending.get(source) === task)
          set((state) => ({
            [source]: {
              ...state[source],
              loading: false,
              error:
                source === 'cloud' ? '云端简历加载失败' : '本地简历加载失败',
            },
          }))
      })
      .finally(() => {
        if (pending.get(source) === task) pending.delete(source)
      })

    pending.set(source, task)

    set((state) => ({
      [source]: { ...state[source], loading: true, error: null },
    }))

    return task
  }

  return {
    accountId: useUserStore.getState().currentUser?.id ?? null,
    cloud: initialResource,
    local: initialResource,
    async loadData() {
      pageOpen = true

      await Promise.all([loadSource('cloud'), loadSource('local')])
    },
    leavePage() {
      pageOpen = false

      // 同轮重挂可以复用请求，实际离开后不能让写入前的响应污染下次访问。
      queueMicrotask(() => {
        if (!pageOpen) pending.clear()
      })
    },
    retrySource: loadSource,
  }
})

useUserStore.subscribe((state, previous) => {
  const accountId = state.currentUser?.id ?? null

  if (accountId === (previous.currentUser?.id ?? null)) return

  pending.clear()

  useIndexStore.setState({
    accountId,
    cloud: initialResource,
    local: initialResource,
  })
})

async function readSource(source: ResumeSource, accountId: string | null) {
  if (source === 'local') return getDashboardOfflineResumes()
  if (!accountId) return { items: [], total: 0 }

  const { getDashboardCloudResumes } =
    await import('@/lib/supabase/resume/summaries')

  return getDashboardCloudResumes(accountId)
}

export default useIndexStore
