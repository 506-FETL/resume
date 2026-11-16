import type { AdminClient } from './types.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'

let cachedAdminClient: AdminClient | null = null

let cachedAdminClientKey: string | null = null

export function createAdminClient(url: string, serviceRoleKey: string) {
  // 复用同一 isolate 内的 admin client：GoTrueClient 的 JWKS 校验缓存挂在实例上（TTL 10 分钟）。
  // 若每个请求都新建 client，该缓存永不命中，每个已登录请求都会额外拉一次 JWKS（多花数百毫秒）。
  const cacheKey = `${url}\u0000${serviceRoleKey}`

  if (cachedAdminClient && cachedAdminClientKey === cacheKey)
    return cachedAdminClient

  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  cachedAdminClientKey = cacheKey

  return cachedAdminClient
}
