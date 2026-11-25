import useUserStore from '@/store/user'

let accountGeneration = 0

const pending = new Map<
  (owner: string) => Promise<unknown>,
  {
    accountId: string
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
  fetcher: (owner: string) => Promise<T>,
  accountId: string,
): Promise<T> {
  const existing = pending.get(fetcher)

  if (
    existing &&
    existing.accountId === accountId &&
    existing.generation === accountGeneration
  )
    return existing.promise as Promise<T>

  const promise = fetcher(accountId).finally(() => {
    if (pending.get(fetcher)?.promise === promise) pending.delete(fetcher)
  })

  pending.set(fetcher, { accountId, generation: accountGeneration, promise })

  return promise
}
