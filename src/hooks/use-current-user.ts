import type { User } from '@supabase/supabase-js'
import useUserStore from '@/store/user'

export default function useCurrentUser() {
  return useUserStore((state) => state.currentUser ?? undefined)
}

/**
 * 获取当前登录用户的头像地址。
 *
 * 该 Hook 基于 `useCurrentUser()` 返回的用户对象，
 * 直接读取 Supabase `user_metadata.avatar_url` 字段。
 *
 * @returns 当前用户头像 URL；若用户未登录或未设置头像，则返回 `undefined`
 */
export function useCurrentUserImage() {
  const user = useCurrentUser()

  return user?.user_metadata?.avatar_url as string | undefined
}

/** 从已经加载的用户对象同步解析协作展示名，避免额外认证请求造成的昵称竞态。 */
export function getUserDisplayName(user: User | null | undefined) {
  const fullName = user?.user_metadata?.full_name

  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim()
  }

  return user ? `用户-${user.id.slice(0, 6)}` : ''
}

/**
 * 获取当前登录用户的展示名称。
 *
 * 该 Hook 基于 `useCurrentUser()` 返回的用户对象，
 * 优先读取 Supabase `user_metadata.full_name` 字段。
 * 当用户未登录或没有配置展示名称时，返回空字符串 `''`。
 *
 * 注意：这里刻意返回**假值**而非占位符（如 `?`）。调用方可能自行提供场景化兜底；
 * 若此处返回真值占位符，会短路掉这些兜底逻辑，使协作通知等场景显示错误名称。
 * 需要占位符的展示场景（如个人资料页）应在各自调用点自行兜底。
 *
 * @returns 当前用户显示名称；缺失时返回 `''`
 */
export function useCurrentUserName() {
  const user = useCurrentUser()

  return (user?.user_metadata?.full_name as string | undefined) ?? ''
}
