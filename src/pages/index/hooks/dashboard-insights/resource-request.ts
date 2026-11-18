import useUserStore from '@/store/user'

let accountGeneration = 0

const pending = new Map<
  () => Promise<unknown>,
  {
    accountId: string | undefined
    generation: number
    promise: Promise<unknown>
  }
>()

useUserStore.subscribe((state, previous) => {
  if (state.currentUser?.id === previous.currentUser?.id) return

  accountGeneration += 1
  pending.clear()
})

export function requestDashboardResource<T>(
  fetcher: () => Promise<T>,
  accountId: string | undefined,
): Promise<T> {
  const existing = pending.get(fetcher)

  if (
    existing &&
    existing.accountId === accountId &&
    existing.generation === accountGeneration
  )
    return existing.promise as Promise<T>

  const promise = fetcher().finally(() => {
    if (pending.get(fetcher)?.promise === promise) pending.delete(fetcher)
  })

  pending.set(fetcher, { accountId, generation: accountGeneration, promise })

  return promise
}
