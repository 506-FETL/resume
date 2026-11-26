import { create } from 'zustand'
import { getDashboardCloudResumes } from '@/lib/supabase/resume/dashboard-cards'
import {
  loadDashboardInsights,
  disconnectDashboardInsights,
} from './hooks/dashboard-insights/resources'
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
  openPage: () => void
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
    openPage() {
      if (pageOpen) return

      pageOpen = true
      loadPageData()
    },
    leavePage() {
      pageOpen = false
      pending.clear()
      disconnectDashboardInsights(false)
    },
    retrySource: loadSource,
  }
})

function loadPageData() {
  const { currentUser, authStatus } = useUserStore.getState()

  if (!pageOpen || authStatus === 'unknown') return

  const { retrySource } = useIndexStore.getState()

  retrySource('cloud')
  retrySource('local')
  loadDashboardInsights(currentUser?.id ?? null)
}

useUserStore.subscribe((state, previous) => {
  const accountId = state.currentUser?.id ?? null
  const changedAccount = accountId !== (previous.currentUser?.id ?? null)

  if (!changedAccount && state.authStatus === previous.authStatus) return

  pending.clear()
  disconnectDashboardInsights(true)

  useIndexStore.setState({
    accountId,
    cloud: initialResource,
    local: initialResource,
  })

  loadPageData()
})

async function readSource(source: ResumeSource, accountId: string | null) {
  if (source === 'local') return getDashboardOfflineResumes()
  if (!accountId) return { items: [], total: 0 }

  return getDashboardCloudResumes(accountId)
}

export default useIndexStore
