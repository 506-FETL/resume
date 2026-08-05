const ASSISTANT_RETURN_TO_STORAGE_KEY = 'gresume:assistant:return-to'

export interface InternalLocationLike {
  pathname: string
  search?: string
  hash?: string
}

export function serializeInternalLocation(location: InternalLocationLike): string {
  return `${location.pathname}${location.search ?? ''}${location.hash ?? ''}`
}

export function isSafeWorkspacePath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//'))
    return false

  try {
    const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    const url = new URL(value, origin)
    return url.origin === origin && !url.pathname.startsWith('/assistant')
  }
  catch {
    return false
  }
}

export function rememberAssistantReturnPath(path: string): void {
  if (!isSafeWorkspacePath(path))
    return

  try {
    sessionStorage.setItem(ASSISTANT_RETURN_TO_STORAGE_KEY, path)
  }
  catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function forgetAssistantReturnPath(): void {
  try {
    sessionStorage.removeItem(ASSISTANT_RETURN_TO_STORAGE_KEY)
  }
  catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function resolveAssistantReturnPath(
  routeStateFrom: unknown,
  allowStoredFallback = false,
): string {
  if (isSafeWorkspacePath(routeStateFrom))
    return routeStateFrom

  if (!allowStoredFallback)
    return '/'

  try {
    const stored = sessionStorage.getItem(ASSISTANT_RETURN_TO_STORAGE_KEY)
    return isSafeWorkspacePath(stored) ? stored : '/'
  }
  catch {
    return '/'
  }
}
