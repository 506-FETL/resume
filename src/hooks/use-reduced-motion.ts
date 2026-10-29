import { useSyncExternalStore } from 'react'

const mediaQuery =
  typeof window === 'undefined'
    ? null
    : window.matchMedia('(prefers-reduced-motion: reduce)')

function subscribe(onChange: () => void) {
  mediaQuery?.addEventListener('change', onChange)

  return () => mediaQuery?.removeEventListener('change', onChange)
}

function getSnapshot() {
  return mediaQuery?.matches ?? false
}

function getServerSnapshot() {
  return false
}

// Motion 12 的同名 hook 只读取挂载时的偏好；这里订阅系统设置的后续变化。
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
