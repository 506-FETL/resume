/* global Deno */

import type { ImportReservation } from './handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import { IMPORT_MAPPING_VERSION } from '../shared/resume-import-contract.ts'
import {
  authenticateSupabaseUser,
  SupabaseAuthenticationError,
} from '../shared/supabase-auth.ts'
import { ImportError, readDailyLimit } from './core.ts'
import { handleImportRequest } from './handler.ts'

Deno.serve(async (request: Request) => {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const apiKey =
    Deno.env.get('DEEPSEEK_API_KEY') ?? Deno.env.get('OPENAI_API_KEY') ?? ''

  // A request-scoped signal also bounds Auth and PostgREST network operations.
  let requestSignal: AbortSignal | undefined

  const admin =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) =>
              fetch(input, {
                ...init,
                signal:
                  requestSignal && init?.signal
                    ? AbortSignal.any([requestSignal, init.signal])
                    : (requestSignal ?? init?.signal),
              }),
          },
        })
      : null

  return handleImportRequest(request, {
    apiKey,
    fetcher: fetch,
    authenticate: async (incoming, signal) => {
      requestSignal = signal

      if (!admin) throw new ImportError('unavailable')

      try {
        const identity = await authenticateSupabaseUser({
          request: incoming,
          client: admin,
          supabaseUrl: url,
        })

        if (!identity.userId) return null

        const jwt = incoming.headers.get('Authorization')!.slice(7).trim()
        const { data, error } = await admin.auth.getUser(jwt)

        if (
          error ||
          !data.user ||
          data.user.id !== identity.userId ||
          data.user.is_anonymous ||
          (!data.user.email_confirmed_at && !data.user.phone_confirmed_at)
        )
          return null

        return identity.userId
      } catch (error) {
        if (error instanceof SupabaseAuthenticationError) return null

        throw new ImportError('unavailable')
      }
    },
    reserve: async ({ userId, contentHash, signal }) => {
      if (!admin) throw new ImportError('unavailable')

      const { data, error } = await admin
        .rpc('reserve_resume_import', {
          p_user_id: userId,
          p_content_hash: contentHash,
          p_version: IMPORT_MAPPING_VERSION,
          p_user_daily_limit: readDailyLimit(
            Deno.env.get('RESUME_IMPORT_USER_DAILY_LIMIT'),
            10,
          ),
          p_global_daily_limit: readDailyLimit(
            Deno.env.get('RESUME_IMPORT_GLOBAL_DAILY_LIMIT'),
            1_000,
          ),
        })
        .abortSignal(signal)

      if (error || !data) throw new ImportError('unavailable')

      return data as ImportReservation
    },
    finish: async ({ userId, contentHash, leaseId, mapping, signal }) => {
      if (!admin) throw new ImportError('unavailable')

      const { data, error } = await admin
        .rpc('finish_resume_import', {
          p_user_id: userId,
          p_content_hash: contentHash,
          p_version: IMPORT_MAPPING_VERSION,
          p_lease_id: leaseId,
          p_mapping: mapping,
        })
        .abortSignal(signal)

      if (error) throw new ImportError('unavailable')

      return data === true
    },
  })
})
