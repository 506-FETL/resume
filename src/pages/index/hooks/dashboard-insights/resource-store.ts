import { create } from 'zustand'
import type { DashboardResource } from './types'

export function createDashboardResource<T>(
  empty: T,
  fetcher: (owner: string) => Promise<T>,
) {
  const initial = { data: empty, loading: true, error: null, hasLoaded: false }
  let owner: string | null = null
  let pending: Promise<T> | undefined

  const useResource = create<DashboardResource<T>>(() => ({
    ...initial,
    retry() {
      if (owner) load(owner)
    },
  }))

  function load(accountId: string | null) {
    owner = accountId

    if (!owner) {
      useResource.setState({ ...initial, loading: false, hasLoaded: true })

      return
    }

    if (pending) return

    const task = fetcher(owner)

    pending = task
    useResource.setState({ loading: true, error: null })

    task.then(
      (data) => {
        if (pending !== task) return

        pending = undefined
        useResource.setState({ data, loading: false, hasLoaded: true })
      },
      () => {
        if (pending !== task) return

        pending = undefined
        useResource.setState({ loading: false, error: '加载失败' })
      },
    )
  }

  function disconnect(clearData: boolean) {
    pending = undefined
    owner = null

    if (clearData) useResource.setState(initial)
  }

  return { useResource, load, disconnect }
}
