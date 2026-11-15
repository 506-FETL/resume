import { useSyncExternalStore } from 'react'

const query =
  typeof window === 'undefined'
    ? null
    : window.matchMedia('(max-height: 500px)')

function subscribe(onChange: () => void) {
  query?.addEventListener('change', onChange)

  return () => query?.removeEventListener('change', onChange)
}

export function useIsShortViewport() {
  return useSyncExternalStore(
    subscribe,
    () => query?.matches ?? false,
    () => false,
  )
}
