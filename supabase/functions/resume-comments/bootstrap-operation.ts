import type { AdminClient } from './types.ts'
import type { CommentTimeOperation } from './bootstrap-types.ts'
import type { SupabaseAuthMode } from '../shared/supabase-auth.ts'
import { buildBootstrapInput } from './bootstrap-input.ts'
import { assertCollaboratorBootstrapLease } from './bootstrap-credentials.ts'
import {
  bootstrapResumeComments,
  assertCurrentSharePasswordGeneration,
  repairBootstrapScope,
} from './bootstrap-rpc.ts'
import { bootstrapProtocolError } from './bootstrap-errors.ts'
import { issueTopics } from './events.ts'

export async function handleBootstrapScope({
  admin,
  userId,
  body,
  tokenSecret,
  collaboratorSecret,
  anonymousPepper,
  realtimeSecret,
  timeOperation,
  json,
  coldStart,
  authMode,
}: {
  admin: AdminClient
  userId: string | null
  body: Record<string, unknown>
  tokenSecret: string
  collaboratorSecret: string
  anonymousPepper: string
  realtimeSecret: string
  timeOperation: CommentTimeOperation
  json: (body: unknown, status?: number) => Response
  coldStart: boolean
  authMode: SupabaseAuthMode
}): Promise<Response> {
  const bootstrapInput = await timeOperation('access_token', () =>
    buildBootstrapInput({
      userId,
      body,
      tokenSecret,
      collaboratorSecret,
      anonymousPepper,
    }),
  )

  await timeOperation('access_token', () =>
    assertCollaboratorBootstrapLease(admin, bootstrapInput.collaboratorLease),
  )

  let rpcInput = bootstrapInput.rpcInput
  let repaired = false

  let result = await timeOperation('rpc', () =>
    bootstrapResumeComments(admin, rpcInput, bootstrapInput.collaboratorLease),
  )

  await timeOperation('access_token', () =>
    assertCurrentSharePasswordGeneration({
      result,
      input: rpcInput,
      tokenSecret: bootstrapInput.shareTokenSecret,
    }),
  )

  if (
    result.status === 'scope_missing' &&
    !repaired &&
    (rpcInput.p_access_kind === 'owner' || rpcInput.p_access_kind === 'share')
  ) {
    const repairEnvelope = result.repair

    const canonicalScopeId = await timeOperation('repair', () =>
      repairBootstrapScope(admin, repairEnvelope),
    )

    repaired = true

    if (rpcInput.p_access_kind === 'share') {
      rpcInput = { ...rpcInput, p_scope_id: canonicalScopeId }
    }

    result = await timeOperation('rpc', () =>
      bootstrapResumeComments(
        admin,
        rpcInput,
        bootstrapInput.collaboratorLease,
      ),
    )

    await timeOperation('access_token', () =>
      assertCurrentSharePasswordGeneration({
        result,
        input: rpcInput,
        tokenSecret: bootstrapInput.shareTokenSecret,
      }),
    )
  }
  if (result.status !== 'ok')
    return bootstrapProtocolError('scope_missing_after_repair')

  const realtime = await timeOperation('realtime_token', () =>
    issueTopics({
      access: {
        kind: result.access.kind,
        scope: { id: result.bootstrap.scope.id },
        userId: result.access.userId,
        versionId: result.access.versionId,
      },
      realtimeSecret,
      tokenSecret,
    }),
  )

  const bootstrapResponse = json({
    ok: true,
    protocolVersion: 1,
    meta: { authMode, repair: repaired, coldStart },
    data: { ...result.bootstrap, ...realtime },
    eventSeq: result.eventSeq,
  })

  bootstrapResponse.headers.set('X-Comment-Auth-Mode', authMode)
  bootstrapResponse.headers.set('X-Comment-Scope-Repair', String(repaired))

  return bootstrapResponse
}
