import { createClient } from '@supabase/supabase-js'
import { recoveryCallback } from '@/lib/auth/recovery-callback'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    // Existing email links use implicit; PKCE callbacks are exchanged once by the SDK.
    auth: { flowType: recoveryCallback.hasCode ? 'pkce' : 'implicit' },
    realtime: {
      heartbeatIntervalMs: 30000,
      reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
      logLevel: import.meta.env.DEV ? 'info' : 'error',
    },
    // 全局配置
    global: {
      headers: {
        'x-client-info': 'resume-app',
      },
    },
  },
)

export default supabase
