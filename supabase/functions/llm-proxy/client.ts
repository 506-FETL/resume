import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'

export function createAdminClient(url: string, serviceRoleKey: string) {
  // 复用同一 isolate 内的 admin client，使 GoTrueClient 的 JWKS 校验缓存跨请求命中，
  // 避免每个已登录请求都重复拉取 JWKS 端点。
  const cacheKey = `${url}\u0000${serviceRoleKey}`

  if (cachedAdminClient && cachedAdminClientKey === cacheKey)
    return cachedAdminClient

  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  cachedAdminClientKey = cacheKey

  return cachedAdminClient
}

let cachedAdminClient: SupabaseClient | null = null

let cachedAdminClientKey: string | null = null
