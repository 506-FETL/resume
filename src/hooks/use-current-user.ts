import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import supabase from '@/lib/supabase/client'

/**
 * 获取当前登录用户，并持续监听认证状态变化。
 *
 * Hook 首次挂载时会主动读取一次当前 session，
 * 随后通过 `supabase.auth.onAuthStateChange` 订阅登录、登出、
 * token 刷新等认证事件，并将最新的 `User` 同步到本地状态。
 *
 * 适用于需要实时感知登录状态变化的 React 组件。
 * 如果只想在某个时刻读取一次用户信息，不需要订阅能力，
 * 则更适合直接使用一次性查询方法。
 *
 * @returns 当前已登录用户；若尚未登录或会话未准备完成，则返回 `undefined`
 */
export default function useCurrentUser() {
  const [auth, setAuth] = useState<User>()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(session?.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session?.user)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return auth
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
