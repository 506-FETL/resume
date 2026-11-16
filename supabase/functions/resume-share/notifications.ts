import type { AdminClient, SavedShareSettings } from './types.ts'
import {
  deriveScopeRealtimeTopic,
  deriveOwnerRealtimeTopic,
  broadcastCommentInvalidation,
} from '../shared/resume-comment-events.ts'

export async function notifyShareCommentSettings({
  admin,
  share,
  userId,
  realtimeSecret,
}: {
  admin: AdminClient
  share: SavedShareSettings
  userId: string
  realtimeSecret: string
}) {
  if (!share.current_release_id || !share.version_id)
    throw new Error('Current share release not found')

  const { data: scope, error: scopeError } = await admin
    .from('resume_comment_scopes')
    .select('id')
    .eq('kind', 'version')
    .eq('version_id', share.version_id)
    .is('archived_at', null)
    .single()

  if (scopeError) throw scopeError

  const { data: eventSeqValue, error: eventError } = await admin.rpc(
    'append_resume_comment_event',
    {
      p_scope_id: scope.id,
      p_thread_id: null,
      p_type: 'settings_changed',
      p_actor_kind: 'user',
      p_actor_id: userId,
      p_payload: { allowComments: share.allow_comments },
    },
  )

  if (eventError) throw eventError

  const topics = await Promise.all([
    deriveScopeRealtimeTopic({
      scopeId: scope.id,
      versionId: share.version_id,
      secret: realtimeSecret,
    }),
    deriveOwnerRealtimeTopic({ userId, secret: realtimeSecret }),
  ])

  await broadcastCommentInvalidation({
    admin,
    topics: topics.map((item) => item.topic),
    eventSeq: Number(eventSeqValue),
    type: 'settings_changed',
  })
}
