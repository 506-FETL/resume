import type { AdminClient, ShareJson, GetResult } from './types.ts'
import type { createRequestContext } from '../shared/request-context.ts'
import type { readShareRequest } from './input.ts'
import {
  readCurrentRelease,
  ensureShareCommentScope,
  loadReleasedShareSource,
} from './repository.ts'
import type { SharedVersionRow } from './live-source.ts'
import { loadLiveShareSource, shareContentRevision } from './live-source.ts'
import {
  derivePasswordGeneration,
  verifyCommentToken,
  signCommentToken,
} from '../shared/resume-comment-auth.ts'
import { sha256, getClientAddress, verifyPassword } from './password.ts'
import { scheduleBackground } from '../shared/operation-metrics.ts'
import {
  deriveScopeRealtimeTopic,
  deriveOwnerRealtimeTopic,
  broadcastCommentInvalidation,
} from '../shared/resume-comment-events.ts'
import {
  redactShareContacts,
  canReadShareComments,
} from '../shared/resume-share-privacy.ts'

export async function readPublicShare({
  req,
  admin,
  serviceRoleKey,
  context,
  json,
  unavailable,
  input,
}: {
  req: Request
  admin: AdminClient
  serviceRoleKey: string
  context: ReturnType<typeof createRequestContext>
  json: ShareJson
  unavailable: () => Response
  input: Awaited<ReturnType<typeof readShareRequest>>
}): Promise<Response> {
  const {
    token,
    password,
    refreshOnly,
    accessToken,
    knownContentRevision,
    operation,
  } = input

  // ============ 匿名读取分支 ============
  if (!token || token.length > 128) return unavailable()

  const { data, error } = await admin
    .from('resume_shares')
    .select(
      `
        id,
        resume_id,
        user_id,
        source_kind,
        is_active,
        password_hash,
        expires_at,
        archived_at,
        allow_comments,
        purpose,
        show_phone,
        show_email,
        version_id,
        current_release_id,
        version:resume_config_versions!resume_shares_version_id_fkey(
          id,
          resume_id,
          user_id,
          status,
          document_revision,
          projection_reference_date
        ),
        current_release:resume_share_releases!resume_shares_current_release_id_fkey(
          id,
          release_no,
          display_name,
          created_at
        )
      `,
    )
    .eq('token', token)
    .maybeSingle()

  if (error) throw error
  if (!data) return unavailable()
  if (!data.is_active || data.archived_at) return unavailable()
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now())
    return unavailable()

  const currentRelease = readCurrentRelease(data.current_release)

  if (!currentRelease || currentRelease.id !== data.current_release_id)
    return unavailable()

  let version = (
    Array.isArray(data.version) ? data.version[0] : data.version
  ) as SharedVersionRow | null

  if (!version || version.id !== data.version_id) return unavailable()

  const commentTokenSecret =
    Deno.env.get('RESUME_COMMENT_TOKEN_SECRET') ?? serviceRoleKey

  const passwordGeneration = await derivePasswordGeneration(
    data.password_hash,
    commentTokenSecret,
  )

  let passwordVerified = false

  if (accessToken && data.password_hash) {
    try {
      const credential = await verifyCommentToken(
        accessToken,
        'share',
        commentTokenSecret,
      )

      // 仅复用密码验证结果；版本、权限与新评论令牌仍按本次读取重新计算。
      passwordVerified =
        credential.shareId === data.id &&
        credential.passwordGeneration === passwordGeneration
    } catch {
      /* 无效或过期凭据回到常规密码校验。 */
    }
  }
  if (data.password_hash && !passwordVerified) {
    if (!password) return json({ needPassword: true } satisfies GetResult)
    if (password.length > 128)
      return json({
        needPassword: true,
        error: 'wrong_password',
      } satisfies GetResult)

    const clientKey = await sha256(getClientAddress(req))

    const [clientLimit, shareLimit] = await Promise.all([
      admin.rpc('consume_resume_share_password_attempt', {
        p_share_id: data.id,
        p_key_hash: clientKey,
        p_limit: 10,
        p_window_seconds: 900,
        p_block_seconds: 900,
      }),
      admin.rpc('consume_resume_share_password_attempt', {
        p_share_id: data.id,
        p_key_hash: '__share_global__',
        p_limit: 200,
        p_window_seconds: 900,
        p_block_seconds: 900,
      }),
    ])

    if (clientLimit.error || shareLimit.error)
      return json({ error: 'temporarily_unavailable' }, 503)
    if (!clientLimit.data || !shareLimit.data) {
      return json(
        {
          needPassword: true,
          error: 'rate_limited',
        } satisfies GetResult,
        429,
      )
    }

    let ok = false

    try {
      ok = await verifyPassword(password, data.password_hash)
    } catch {
      context.log({
        level: 'error',
        event: 'password_verify_failed',
        operation,
        status: 503,
        errorCode: 'unexpected',
      })

      return json({ error: 'temporarily_unavailable' }, 503)
    }

    if (!ok)
      return json({
        needPassword: true,
        error: 'wrong_password',
      } satisfies GetResult)

    const { error: clearError } = await admin.rpc(
      'clear_resume_share_password_attempts',
      {
        p_share_id: data.id,
        p_key_hash: clientKey,
      },
    )

    if (clearError) {
      context.log({
        level: 'warn',
        event: 'password_attempt_cleanup_failed',
        operation,
        status: 200,
        errorCode: 'database_unexpected',
        sqlState: clearError.code,
      })
    }
  }

  // 校验通过后原子记录访问；统计失败不阻断简历查看。
  if (!refreshOnly) {
    scheduleBackground(
      (async () => {
        const { error: viewError } = await admin.rpc(
          'record_resume_share_view',
          { p_share_id: data.id },
        )

        if (viewError) {
          context.log({
            level: 'warn',
            event: 'view_counter_failed',
            operation,
            status: 200,
            errorCode: 'database_unexpected',
            sqlState: viewError.code,
          })
        }
      })(),
      'view_counter_failed',
    )
  }

  const sourceKind = data.source_kind === 'current' ? 'current' : 'history'

  const source =
    sourceKind === 'current'
      ? await loadLiveShareSource({
          admin,
          resumeId: data.resume_id,
          ownerUserId: data.user_id,
          ensureScope: ensureShareCommentScope,
          onSync: (scopeId, versionId, eventSeq) => {
            scheduleBackground(
              (async () => {
                const secret =
                  Deno.env.get('RESUME_COMMENT_REALTIME_SECRET') ??
                  commentTokenSecret

                const topics = await Promise.all([
                  deriveScopeRealtimeTopic({ scopeId, versionId, secret }),
                  deriveOwnerRealtimeTopic({ userId: data.user_id, secret }),
                ])

                await broadcastCommentInvalidation({
                  admin,
                  topics: topics.map((item) => item.topic),
                  eventSeq,
                  type: 'document_synced',
                })
              })(),
              'live_share_comment_notification_failed',
            )
          },
        })
      : await loadReleasedShareSource(admin, currentRelease, version)

  version = source.version

  const commentScope = source.commentScope

  // 读取过程中可能发生换版、关分享或改密码；不得签发跨身份的访问凭据。
  const { data: authorizedShare, error: authorizationError } = await admin
    .from('resume_shares')
    .select(
      'version_id,current_release_id,source_kind,is_active,archived_at,expires_at,password_hash,allow_comments,purpose,show_phone,show_email',
    )
    .eq('id', data.id)
    .single()

  if (authorizationError) throw authorizationError
  if (
    !authorizedShare ||
    !authorizedShare.is_active ||
    authorizedShare.archived_at ||
    (authorizedShare.expires_at &&
      new Date(authorizedShare.expires_at).getTime() <= Date.now())
  ) {
    return unavailable()
  }
  if (authorizedShare.password_hash !== data.password_hash)
    return json({ needPassword: true } satisfies GetResult)
  if (
    authorizedShare.version_id !== version.id ||
    authorizedShare.current_release_id !== currentRelease.id ||
    authorizedShare.source_kind !== sourceKind
  ) {
    return json({ error: 'temporarily_unavailable' }, 503)
  }

  const publicSnapshot = redactShareContacts(source.snapshot, authorizedShare)

  const publicDisplayName = redactShareContacts(
    {
      basics: (source.snapshot as Record<string, unknown> | null)?.basics,
      displayName: source.displayName,
    },
    authorizedShare,
  ).displayName

  const commentsVisible = canReadShareComments(authorizedShare)

  const contentRevision = shareContentRevision({
    snapshot: publicSnapshot,
    templateManifest: source.templateManifest,
    displayName: publicDisplayName,
    sourceKind,
    versionId: version.id,
    documentRevision: version.document_revision,
  })

  const privacyRevision = `${contentRevision}:${authorizedShare.purpose ?? 'legacy'}:${authorizedShare.show_phone}:${authorizedShare.show_email}`
  const notModified = knownContentRevision === privacyRevision
  const issuedAt = Math.floor(Date.now() / 1_000)
  const expiresAtSeconds = issuedAt + 15 * 60

  const commentAccessToken = await signCommentToken(
    {
      version: 1,
      kind: 'share',
      issuedAt,
      expiresAt: expiresAtSeconds,
      shareId: data.id,
      versionId: version.id,
      releaseId: currentRelease.id,
      scopeId: commentScope.id,
      passwordGeneration,
    },
    commentTokenSecret,
  )

  // 当前链接解析已保存配置；历史链接保留发布快照。相同内容不重复传输大对象。
  return json({
    source_kind: sourceKind,
    content_revision: privacyRevision,
    not_modified: notModified,
    ...(notModified
      ? {}
      : {
          snapshot: publicSnapshot,
          template_manifest: source.templateManifest,
        }),
    display_name: publicDisplayName,
    share_id: data.id,
    release_id: currentRelease.id,
    release_no: currentRelease.release_no,
    version_id: version.id,
    document_revision: version.document_revision,
    allow_comments: commentsVisible && authorizedShare.allow_comments,
    projection_reference_date: commentScope.projectionReferenceDate,
    comment_scope_id: commentScope.id,
    ...(commentsVisible ? { comment_access_token: commentAccessToken } : {}),
    comment_access_expires_at: new Date(expiresAtSeconds * 1_000).toISOString(),
  } satisfies GetResult)
}
