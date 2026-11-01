import type { HistoryResumeOption } from '../types'
import useUserStore from '@/store/user'
import { useEffect } from 'react'
import { create } from 'zustand'
import { listResumeHistoryOptions } from '@/lib/supabase/resume'
import { buildHistoryResumeOption } from '../utils'

interface HistoryResumeOptionsStore {
  resumeOptions: HistoryResumeOption[]
  loading: boolean
  error: string | null
  hydrated: boolean
  reload: () => Promise<void>
}

let accountId = useUserStore.getState().currentUser?.id ?? null
let generation = 0

const useHistoryResumeOptionsStore = create<HistoryResumeOptionsStore>()(
  (set) => ({
    resumeOptions: [],
    loading: false,
    error: null,
    hydrated: false,
    reload: async () => {
      const request = ++generation

      set({ loading: true })

      try {
        const options = await listResumeHistoryOptions()

        if (request !== generation) return

        set({
          resumeOptions: options.map(buildHistoryResumeOption),
          error: null,
          hydrated: true,
        })
      } catch (loadError) {
        if (request !== generation) return

        const message =
          loadError instanceof Error ? loadError.message : '简历列表加载失败'

        set({ resumeOptions: [], error: message, hydrated: true })
      } finally {
        if (request === generation) set({ loading: false })
      }
    },
  }),
)

useUserStore.subscribe((state) => {
  const nextAccountId = state.currentUser?.id ?? null

  if (accountId === nextAccountId) return

  accountId = nextAccountId
  generation += 1

  useHistoryResumeOptionsStore.setState({
    resumeOptions: [],
    loading: false,
    error: null,
    hydrated: false,
  })
})

export function useHistoryResumeOptions() {
  const resumeOptions = useHistoryResumeOptionsStore((s) => s.resumeOptions)
  const loading = useHistoryResumeOptionsStore((s) => s.loading)
  const error = useHistoryResumeOptionsStore((s) => s.error)
  const hydrated = useHistoryResumeOptionsStore((s) => s.hydrated)
  const reload = useHistoryResumeOptionsStore((s) => s.reload)

  useEffect(() => {
    if (!hydrated && !loading) {
      reload()
    }
  }, [hydrated, loading, reload])

  return {
    resumeOptions,
    loading: loading || !hydrated,
    error,
    reload,
  }
}
