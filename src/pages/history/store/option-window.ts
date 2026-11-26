import { create } from 'zustand'
import { getErrorMessage } from '@/utils/error'

export interface OptionWindow<Row> {
  items: Row[]
  hasMore: boolean
  ready: boolean
  loading: boolean
  error: string | null
}

type Purpose = 'probe' | 'open' | 'more'

const pageSize = 10

export function createOptionWindow<Row>(
  read: (owner: string, offset: number, limit: number) => Promise<Row[]>,
) {
  const initial: OptionWindow<Row> = {
    items: [],
    hasMore: true,
    ready: false,
    loading: false,
    error: null,
  }

  let pending: Promise<void> | undefined

  return create<
    OptionWindow<Row> & {
      load: (owner: string, purpose: Purpose) => Promise<void>
      reset: () => void
    }
  >((set, get) => ({
    ...initial,
    reset: () => {
      pending = undefined
      set(initial)
    },
    load: (owner, purpose) => {
      const { items, ready, hasMore } = get()

      if (
        !hasMore ||
        (purpose === 'probe' && (ready || items.length)) ||
        (purpose === 'open' && ready)
      )
        return Promise.resolve()
      if (pending) return pending

      const count =
        purpose === 'probe' ? 1 : ready ? pageSize : pageSize - items.length

      const limit = purpose === 'probe' ? 1 : count + 1

      set({ loading: true, error: null })

      const task = read(owner, items.length, limit)
        .then((rows) => {
          if (pending !== task) return

          set({
            items: [...items, ...rows.slice(0, count)],
            ready: purpose !== 'probe' || !rows.length,
            hasMore: rows.length === limit,
            loading: false,
          })
        })
        .catch((error) => {
          if (pending === task)
            set({
              loading: false,
              error: getErrorMessage(error, '选项加载失败'),
            })
        })
        .finally(() => {
          if (pending === task) pending = undefined
        })

      pending = task

      return task
    },
  }))
}
