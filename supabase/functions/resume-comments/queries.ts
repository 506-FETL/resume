import type { AdminClient, ResolvedAccess } from './types.ts'

export async function loadThreads(
  admin: AdminClient,
  scopeId: string,
  threadIds?: string[],
) {
  if (threadIds?.length === 0) return { threads: [], profiles: [] }

  let query = admin
    .from('resume_comment_threads')
    .select(
      `
      id,
      scope_id,
      anchor,
      anchor_status,
      original_page_index,
      revision,
      resolved_at,
      resolved_by_kind,
      resolved_by_id,
      last_activity_at,
      created_at,
      updated_at,
      comments:resume_comments(
        id,
        thread_id,
        parent_id,
        author_kind,
        author_user_id,
        author_anonymous_id,
        body,
        edited_at,
        deleted_at,
        created_at,
        updated_at
      )
    `,
    )
    .eq('scope_id', scopeId)
    .is('deleted_at', null)

  if (threadIds) query = query.in('id', threadIds)

  const { data, error } = await query.order('last_activity_at', {
    ascending: false,
  })

  if (error) {
    throw error
  }

  const threads = data ?? []

  const userIds = Array.from(
    new Set(
      threads.flatMap((thread) => {
        const comments = Array.isArray(thread.comments) ? thread.comments : []

        return comments.flatMap((comment) =>
          comment.author_user_id ? [comment.author_user_id] : [],
        )
      }),
    ),
  )

  const profiles =
    userIds.length > 0
      ? await admin
          .from('profiles')
          .select('id,full_name,avatar_url')
          .in('id', userIds)
      : { data: [], error: null }

  if (profiles.error) {
    throw profiles.error
  }

  return { threads, profiles: profiles.data ?? [] }
}

// 旧 bootstrap/recovery 快速回滚仍需保留此读取器。
// eslint-disable-next-line unused-imports/no-unused-vars
async function loadReadState(admin: AdminClient, access: ResolvedAccess) {
  if (!access.actorKind || !access.actorId) {
    return 0
  }

  let query = admin
    .from('resume_comment_read_states')
    .select('last_read_event_seq')
    .eq('scope_id', access.scope.id)
    .eq('principal_kind', access.actorKind)

  query =
    access.actorKind === 'user'
      ? query.eq('principal_user_id', access.actorId)
      : query.eq('principal_anonymous_id', access.actorId)

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw error
  }

  return Number(data?.last_read_event_seq ?? 0)
}

export async function loadThreadCounts(admin: AdminClient, scopeId: string) {
  const { data, error } = await admin
    .from('resume_comment_threads')
    .select('anchor_status,resolved_at')
    .eq('scope_id', scopeId)
    .is('deleted_at', null)

  if (error) throw error

  return countThreadRows(data ?? [])
}

function countThreadRows(
  threads: Array<{ anchor_status: string; resolved_at: string | null }>,
) {
  return threads.reduce(
    (counts, thread) => {
      if (thread.anchor_status === 'detached') counts.detached += 1
      else if (thread.resolved_at) counts.resolved += 1
      else counts.unresolved += 1

      return counts
    },
    { unresolved: 0, resolved: 0, detached: 0 },
  )
}

// 旧 bootstrap/recovery 快速回滚仍需保留此读取器。
// eslint-disable-next-line unused-imports/no-unused-vars
async function loadVersionReference(admin: AdminClient, versionId: number) {
  const [versionResult, shareCountResult] = await Promise.all([
    admin
      .from('resume_config_versions')
      .select(
        'id,version_no,version_name,milestone_name,status,content_hash,document_revision,projection_reference_date',
      )
      .eq('id', versionId)
      .single(),
    admin
      .from('resume_shares')
      .select('id', { count: 'exact', head: true })
      .eq('version_id', versionId)
      .is('archived_at', null),
  ])

  if (versionResult.error) throw versionResult.error
  if (shareCountResult.error) throw shareCountResult.error

  return {
    ...versionResult.data,
    shared_link_count: shareCountResult.count ?? 0,
  }
}
