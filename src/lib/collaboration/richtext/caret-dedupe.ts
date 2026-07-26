/**
 * 协作光标去重：按“人类身份”而非易变的 Yjs clientID 决定某个 awareness 状态是否渲染光标。
 *
 * 背景：`@tiptap/y-tiptap` 的 `yCursorPlugin` 默认对每个 awareness clientId 各渲染一个光标，
 * 仅过滤掉自己（`currentClientId !== userClientId`）。而同一个人在重连、StrictMode 双挂载、
 * host 种子化竞态（旧 provider 未连接成功即销毁，awareness 移除广播被丢弃）等情况下，
 * 会在远端遗留多个 clientId 的 awareness 状态。于是同一个人叠出多个光标标签
 * （如 "seams" 重叠三次）。y-protocols 要 30s 超时才回收，期间一直重影。
 *
 * 去重排序依据（关键）：
 * 1. Yjs 的 `clientID` 是 `random.uint32` 生成的**随机值**，并非单调递增，
 *    因此“clientId 最大 = 最新”是错误假设，不能用来判活。
 * 2. 正确的“活跃度”信号是 `awareness.meta.get(clientId).lastUpdated`（收到该 clientId
 *    awareness 更新时刷新的 unix 时间戳）。活跃端每 ~15s 心跳 + 每次光标移动都会刷新它；
 *    幽灵端（owner 已断开）不再有更新，其 lastUpdated 冻结，直至 30s 超时被回收。
 * 3. 进一步优先“当前确实持有光标（cursor != null）”的状态——正在编辑者才有实时 cursor。
 *
 * 综合：对同一“人类身份”（优先 `user.id`，缺失时回退 `name|color`），选
 * `(hasCursor, lastUpdated)` 字典序最大的那个 clientId 渲染，其余判为陈旧幽灵。
 * 完全无可辨识信息时才保守渲染（仅去自身）。
 *
 * 注：身份必须从连接第一帧就带上（见 store.setLocalUser 写入 id），否则缺 id 的幽灵
 * 会各自成组、无法与真身合并去重——这正是“协作者互相看到重叠光标”的根因之一。
 */

export interface AwarenessLikeState {
  user?: { id?: string, name?: string, color?: string } | null
  cursor?: unknown
  [key: string]: unknown
}

export interface AwarenessMetaLike {
  lastUpdated?: number
}

/**
 * 从 awareness 状态推导“人类身份键”，用于分组去重。
 *
 * 优先用稳定的 `user.id`（登录 userId）；缺失时（如极早期帧、旧数据、未带 id 的幽灵）
 * 退化为 `name|color` 组合键，保证同一个人的多个 clientId 仍能被归为一组去重，
 * 而不是因为缺 id 就各自渲染导致重叠。完全没有可辨识信息时返回 null（不参与去重）。
 */
export function identityOf(state: AwarenessLikeState | undefined | null): string | null {
  const user = state?.user
  if (!user) {
    return null
  }
  if (user.id != null && user.id !== '') {
    return `id:${user.id}`
  }
  const name = user.name ?? ''
  const color = user.color ?? ''
  if (name === '' && color === '') {
    return null
  }
  return `nc:${name}|${color}`
}

/** 判定 a 是否比 b“更活跃/更该保留”：先比是否有光标，再比 lastUpdated。 */
function isBetter(
  aClientId: number,
  bClientId: number,
  states: Map<number, AwarenessLikeState>,
  meta: Map<number, AwarenessMetaLike> | undefined,
): boolean {
  const aHasCursor = states.get(aClientId)?.cursor != null
  const bHasCursor = states.get(bClientId)?.cursor != null
  if (aHasCursor !== bHasCursor) {
    return aHasCursor
  }
  const aUpdated = meta?.get(aClientId)?.lastUpdated ?? 0
  const bUpdated = meta?.get(bClientId)?.lastUpdated ?? 0
  if (aUpdated !== bUpdated) {
    return aUpdated > bUpdated
  }
  // 完全并列时用 clientId 兜底，保证选择稳定、幂等（避免抖动）。
  return aClientId > bClientId
}

/**
 * 在给定的 awareness 全量状态中，找出每个“人类身份”对应的“最应保留”的 clientId。
 * 返回 `identity -> winnerClientId` 映射，供过滤器判定。
 */
export function computeWinningClientIdByUser(
  states: Map<number, AwarenessLikeState>,
  meta?: Map<number, AwarenessMetaLike>,
): Map<string, number> {
  const winner = new Map<string, number>()
  states.forEach((state, clientId) => {
    const identity = identityOf(state)
    if (identity == null) {
      return
    }
    const prev = winner.get(identity)
    if (prev == null || isBetter(clientId, prev, states, meta)) {
      winner.set(identity, clientId)
    }
  })
  return winner
}

/**
 * 生成传给 `yCursorPlugin` 的 `awarenessStateFilter`。
 *
 * - 永远过滤掉本地 clientId（不渲染自己的光标，和默认行为一致）。
 * - 能推导出身份时：仅保留该身份当前“最应保留”的 clientId，滤掉同一人的陈旧幽灵。
 * - 完全无可辨识信息时：保守渲染（只滤自己）。
 *
 * `getStates` / `getMeta` 惰性读取当前 awareness 快照，确保每次过滤都基于最新数据。
 */
export function createDedupeAwarenessFilter(
  getStates: () => Map<number, AwarenessLikeState>,
  getMeta?: () => Map<number, AwarenessMetaLike>,
) {
  return (currentClientId: number, userClientId: number, state: AwarenessLikeState): boolean => {
    if (currentClientId === userClientId) {
      return false
    }

    const identity = identityOf(state)
    if (identity == null) {
      return true
    }

    const winner = computeWinningClientIdByUser(getStates(), getMeta?.())
    const winnerForUser = winner.get(identity)
    // 若查不到（理论上不会），保守渲染；否则只渲染胜出的 clientId。
    return winnerForUser == null || winnerForUser === userClientId
  }
}
