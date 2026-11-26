import { useEffect, useState } from 'react'

type DrawerModule = typeof import('@/components/ui/drawer')

let loaded: DrawerModule | undefined

export function usePreviewDrawer(mobile: boolean) {
  const [drawer, setDrawer] = useState(loaded)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!mobile || drawer) return

    let active = true

    import('@/components/ui/drawer').then(
      (module) => {
        loaded = module

        if (active) setDrawer(module)
      },
      () => {
        if (active) setFailed(true)
      },
    )

    return () => {
      active = false
    }
  }, [mobile, drawer, attempt])

  function retry() {
    setFailed(false)
    setAttempt((current) => current + 1)
  }

  return { drawer, failed, retry }
}
