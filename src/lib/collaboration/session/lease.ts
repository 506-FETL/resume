import { CollaborationOperationError } from './service'

export const COLLABORATION_LEASE_INTERVAL_MS = 30_000

export function isCollaborationRevokedError(error: unknown) {
  return error instanceof CollaborationOperationError
    && (error.code === 'unauthorized' || error.status === 401)
}

export function startCollaborationLeaseMonitor(options: {
  renew: () => Promise<void>
  onRevoked: (error: unknown) => void
  onTransientError: (error: unknown) => void
}) {
  if (typeof document === 'undefined') {
    return () => undefined
  }

  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let tick: () => Promise<void>

  const schedule = () => {
    if (timer) {
      clearTimeout(timer)
    }
    if (!stopped) {
      timer = setTimeout(tick, COLLABORATION_LEASE_INTERVAL_MS)
    }
  }

  tick = async () => {
    if (stopped || running) {
      return
    }
    timer = null
    running = true
    try {
      await options.renew()
    }
    catch (error) {
      if (isCollaborationRevokedError(error)) {
        stopped = true
        options.onRevoked(error)
      }
      else {
        options.onTransientError(error)
      }
    }
    finally {
      running = false
      schedule()
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (timer) {
        clearTimeout(timer)
      }
      timer = null
      tick().catch(options.onTransientError)
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  schedule()

  return () => {
    stopped = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
