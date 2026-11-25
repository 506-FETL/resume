import { useEffect } from 'react'
import useUserStore from '@/store/user'
import useShareStore from '../store'

export function useSharePageBootstrap() {
  const ownerId = useUserStore((state) => state.currentUser?.id)
  const nextExpiry = useShareStore((state) => state.pageStats?.nextExpiry)

  useEffect(() => {
    if (!ownerId) return

    const store = useShareStore.getState()

    store.bootstrapPage()

    return store.leaveManagement
  }, [ownerId])

  useEffect(() => {
    if (!nextExpiry) return

    let timer: ReturnType<typeof setTimeout>

    const refresh = () => {
      const delay = Date.parse(nextExpiry) - Date.now()

      if (delay <= 0) {
        useShareStore.getState().invalidateManagement()

        return
      }

      timer = setTimeout(refresh, Math.min(2147483647, delay))
    }

    refresh()

    return () => clearTimeout(timer)
  }, [nextExpiry])
}
