import useUserStore from '@/store/user'

export interface TrackerAccountScope {
  userId: string | null
  generation: number
}

let scope: TrackerAccountScope = { userId: useUserStore.getState().currentUser?.id ?? null, generation: 0 }
const listeners = new Set<() => void>()

// 使用代次覆盖 A → B → A；同账号刷新令牌不会打断输入或清空缓存。
useUserStore.subscribe((state) => {
  const userId = state.currentUser?.id ?? null
  if (userId === scope.userId)
    return
  scope = { userId, generation: scope.generation + 1 }
  listeners.forEach(listener => listener())
})

export const getTrackerAccountScope = () => scope
export function subscribeTrackerAccountScope(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export class TrackerAccountScopeError extends Error {
  constructor() {
    super('登录状态已变更，请重新操作')
    this.name = 'TrackerAccountScopeError'
  }
}

export const isTrackerAccountScopeError = (error: unknown) => error instanceof TrackerAccountScopeError
export const isTrackerAccountScopeCurrent = (requestScope: TrackerAccountScope) => requestScope === scope && Boolean(scope.userId)

export function assertTrackerAccountScope(requestScope: TrackerAccountScope) {
  if (!isTrackerAccountScopeCurrent(requestScope))
    throw new TrackerAccountScopeError()
}

// 在 API 等待 getCurrentUser 后再次校验，防止旧表单以新账号的身份提交。
export function createTrackerAccountGuard(requestScope: TrackerAccountScope) {
  return (userId: string | null) => {
    assertTrackerAccountScope(requestScope)
    if (userId !== requestScope.userId)
      throw new TrackerAccountScopeError()
  }
}
