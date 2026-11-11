import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { shareContentRevision } from '../../../supabase/functions/resume-share/live-source.ts'
import {
  buildCommentAnchorDocument,
  sha256Hex,
} from '../../../supabase/functions/shared/resume-comment-core.ts'
import { redactHiddenResumeSections } from '../../../supabase/functions/shared/resume-share-redaction.ts'
import {
  fixtureSnapshot,
  originalEmail,
  originalPhone,
} from './fixture-snapshot.mjs'

const projectRef = 'bitxrpdtlohlnywgusfw'
const projectUrl = `https://${projectRef}.supabase.co`

async function main() {
  const runId = `${Date.now()}-${randomBytes(4).toString('hex')}`
  const resumeId = randomUUID()
  const checks = []
  const requests = []
  let stage = '读取本地凭据'
  let failure = null
  let admin
  let owner
  let cleanup = null

  const check = async (name, action) => {
    stage = name
    await action()
    checks.push(name)
  }

  try {
    const keys = JSON.parse(
      await readFile(
        new URL('../database/project-keys.json', import.meta.url),
        'utf8',
      ),
    )

    const serviceKey = keys.find(
      (entry) => entry.name === 'service_role',
    )?.api_key

    const anonKey = keys.find((entry) => entry.name === 'anon')?.api_key

    assert.equal(typeof serviceKey, 'string')
    assert.equal(typeof anonKey, 'string')

    admin = client(serviceKey)

    stage = '创建本轮合成账号'

    const email = `resume-privacy-smoke-${runId}@example.com`
    const password = `Privacy!${randomBytes(24).toString('base64url')}`

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { test_run: runId, test_purpose: 'share-contact-mask' },
    })

    requireSuccess(created)
    assert.ok(created.data.user?.id)
    owner = { id: created.data.user.id, client: client(anonKey) }

    const signedIn = await owner.client.auth.signInWithPassword({
      email,
      password,
    })

    requireSuccess(signedIn)

    const accessToken = signedIn.data.session.access_token

    const edge = async (name, body, authenticated = false) => {
      const startedAt = performance.now()
      const publicRead = name === 'resume-share' && !body.op

      const response = await fetch(
        `${projectUrl}/functions/v1/${name}?forceFunctionRegion=us-east-1`,
        {
          method: 'POST',
          headers: publicRead
            ? { 'Content-Type': 'text/plain;charset=UTF-8' }
            : {
                'Content-Type': 'application/json',
                apikey: anonKey,
                ...(authenticated
                  ? { Authorization: `Bearer ${accessToken}` }
                  : {}),
              },
          body: JSON.stringify(body),
          cache: 'no-store',
        },
      )

      requests.push({
        function: name,
        operation: body.op ?? 'read',
        status: response.status,
        region: response.headers.get('x-sb-edge-region'),
        elapsedMs: Math.round(performance.now() - startedAt),
      })

      return {
        status: response.status,
        data: await response.json(),
        cacheControl: response.headers.get('cache-control'),
      }
    }

    const readShare = async (share, knownContentRevision) => {
      const result = await edge('resume-share', {
        token: share.token,
        refresh: true,
        knownContentRevision,
      })

      assert.equal(result.status, 200)
      assert.ok(result.cacheControl?.includes('no-store'))

      return result.data
    }

    const updateSettings = async (share, showPhone, showEmail) => {
      const result = await edge(
        'resume-share',
        {
          op: 'update_settings',
          shareId: share.id,
          label: '合成隐私验收',
          expiresAt: null,
          allowComments: showPhone && showEmail,
          showPhone,
          showEmail,
        },
        true,
      )

      assert.equal(result.status, 200)
    }

    stage = '读取真实已发布默认模板'

    const resource = await owner.client
      .from('official_resume_template_versions')
      .select('version,content,content_hash')
      .eq('template_id', 'default')
      .not('published_at', 'is', null)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    requireSuccess(resource)
    assert.equal(sha256Hex(resource.data.content), resource.data.content_hash)

    const definition = JSON.parse(resource.data.content)

    const binding = {
      source: 'official',
      templateId: definition.templateId,
      templateVersion: definition.version,
    }

    const sourceSnapshot = fixtureSnapshot(binding)
    const publicSnapshot = redactHiddenResumeSections(sourceSnapshot)
    const { templateBinding, ...configFields } = sourceSnapshot
    const displayName = `合成分享 ${originalPhone} ${originalEmail}`

    const manifest = {
      schemaVersion: 3,
      templateId: definition.templateId,
      templateVersion: definition.version,
      definition,
      assets: definition.assets,
    }

    stage = '插入合成简历与固定版本'

    requireSuccess(
      await owner.client.from('resume_config').insert({
        ...configFields,
        resume_id: resumeId,
        user_id: owner.id,
        template_binding: templateBinding,
        display_name: displayName,
      }),
    )

    stage = '读取触发器生成的实际工作版本'

    // AFTER INSERT 的后续 UPDATE 不会回填最初的 INSERT RETURNING。
    const config = await owner.client
      .from('resume_config')
      .select('current_version_id')
      .eq('resume_id', resumeId)
      .eq('user_id', owner.id)
      .single()

    requireSuccess(config)
    assert.ok(Number.isSafeInteger(config.data.current_version_id))

    const versionFields =
      'id,version_no,version_name,created_at,document_revision,projection_reference_date,snapshot,status'

    const active = await owner.client
      .from('resume_config_versions')
      .select(versionFields)
      .eq('id', config.data.current_version_id)
      .eq('user_id', owner.id)
      .single()

    requireSuccess(active)

    stage = '插入合成固定版本'

    const frozen = await owner.client
      .from('resume_config_versions')
      .insert({
        user_id: owner.id,
        resume_id: resumeId,
        version_name: '合成固定版本',
        source_type: 'manual',
        snapshot: sourceSnapshot,
        status: 'frozen',
        projection_reference_date: active.data.projection_reference_date,
      })
      .select(versionFields)
      .single()

    requireSuccess(frozen)

    stage = '调用真实事务发布 current/history 分享'

    const createShare = async (sourceKind, version, purpose) => {
      const token = randomBytes(32).toString('hex')

      const anchor = buildCommentAnchorDocument(
        publicSnapshot,
        version.projection_reference_date,
      )

      const history = sourceKind === 'history'

      const result = await owner.client.rpc('create_resume_share_release', {
        p_resume_id: resumeId,
        p_token: token,
        p_version_id: version.id,
        p_snapshot: publicSnapshot,
        p_template_manifest: manifest,
        p_display_name: displayName,
        p_source_kind: sourceKind,
        p_source_version_id: history ? version.id : null,
        p_source_version_no: history ? version.version_no : null,
        p_source_version_label: history ? version.version_name : null,
        p_source_version_created_at: history ? version.created_at : null,
        p_anchor_document: anchor.document,
        p_document_hash: anchor.documentHash,
        p_projection_reference_date: version.projection_reference_date,
        p_expected_document_revision: version.document_revision,
        p_label: '合成隐私验收',
        p_expires_at: null,
        p_purpose: purpose,
        p_show_phone: true,
        p_show_email: true,
        p_allow_comments: purpose === 'review',
        p_activate: true,
      })

      requireSuccess(result)

      return { id: result.data, token, sourceKind, purpose }
    }

    const current = await createShare('current', active.data, 'review')
    const history = await createShare('history', frozen.data, 'application')

    for (const share of [current, history]) {
      let previous

      await check(`${share.sourceKind} 原始公开值和评论凭据有效`, async () => {
        previous = await readShare(share)
        assert.equal(previous.source_kind, share.sourceKind)
        assert.equal(previous.snapshot.basics.phone, originalPhone)
        assert.equal(previous.snapshot.basics.email, originalEmail)
        assert.equal(typeof previous.comment_access_token, 'string')

        const comment = await edge('resume-comments', {
          op: 'bootstrap_scope',
          accessKind: 'share',
          accessToken: previous.comment_access_token,
          versionId: previous.version_id,
          releaseId: previous.release_id,
        })

        assert.equal(comment.status, 200)
        assert.equal(comment.data.ok, true)
      })

      const oldComment = previous

      for (const [showPhone, showEmail] of [
        [false, true],
        [true, false],
        [false, false],
        [true, true],
      ]) {
        await check(
          `${share.sourceKind} 电话 ${showPhone} / 邮箱 ${showEmail} 与条件刷新`,
          async () => {
            await updateSettings(share, showPhone, showEmail)

            const next = await readShare(share, previous.content_revision)

            assert.equal(next.not_modified, false)

            assert.equal(
              next.snapshot.basics.phone,
              showPhone ? originalPhone : 'XXXXXXX',
            )

            assert.equal(
              next.snapshot.basics.email,
              showEmail ? originalEmail : 'XXXXXXX',
            )

            const body = JSON.stringify({
              snapshot: next.snapshot,
              name: next.display_name,
            })

            assert.equal(body.includes(originalPhone), showPhone)
            assert.equal(body.includes(originalEmail), showEmail)

            assert.ok(
              !next.snapshot.self_evaluation.content.includes('XXXXXXX'),
            )

            if (!showPhone || !showEmail) {
              assert.equal(next.allow_comments, false)
              assert.ok(!('comment_access_token' in next))

              const denied = await edge('resume-comments', {
                op: 'bootstrap_scope',
                accessKind: 'share',
                accessToken: oldComment.comment_access_token,
                versionId: oldComment.version_id,
                releaseId: oldComment.release_id,
              })

              assert.equal(denied.status, 404)
              assert.equal(denied.data.error?.code, 'share_unavailable')
            }

            const unchanged = await readShare(share, next.content_revision)

            assert.equal(unchanged.not_modified, true)
            assert.ok(!('snapshot' in unchanged))

            if (!showPhone && !showEmail) {
              const legacySnapshot = structuredClone(next.snapshot)

              legacySnapshot.basics.phone = ''
              legacySnapshot.basics.email = ''

              const oldRevision = `${shareContentRevision({
                snapshot: legacySnapshot,
                templateManifest: next.template_manifest,
                displayName: next.display_name,
                sourceKind: next.source_kind,
                versionId: next.version_id,
                documentRevision: next.document_revision,
              })}:${share.purpose}:false:false`

              assert.notEqual(next.content_revision, oldRevision)

              const refreshed = await readShare(share, oldRevision)

              assert.equal(refreshed.not_modified, false)
              assert.equal(refreshed.snapshot.basics.phone, 'XXXXXXX')
              assert.equal(refreshed.snapshot.basics.email, 'XXXXXXX')
            }

            previous = next
          },
        )
      }
    }

    await check('隐私设置不改写原始正文和固定快照', async () => {
      const saved = await owner.client
        .from('resume_config')
        .select('basics')
        .eq('resume_id', resumeId)
        .single()

      const fixed = await owner.client
        .from('resume_config_versions')
        .select('snapshot')
        .eq('id', frozen.data.id)
        .single()

      requireSuccess(saved)
      requireSuccess(fixed)
      assert.deepEqual(saved.data.basics, sourceSnapshot.basics)
      assert.deepEqual(fixed.data.snapshot, sourceSnapshot)
    })

    await check('保存后 current 同步，history 保持固定', async () => {
      requireSuccess(
        await owner.client
          .from('resume_config')
          .update({
            basics: {
              ...sourceSnapshot.basics,
              name: '合成当前已更新',
              phone: '13900139000',
              email: 'updated-contact@example.com',
            },
          })
          .eq('resume_id', resumeId)
          .eq('user_id', owner.id),
      )

      const live = await readShare(current)
      const fixed = await readShare(history)

      assert.equal(live.snapshot.basics.name, '合成当前已更新')
      assert.equal(live.snapshot.basics.phone, '13900139000')
      assert.equal(live.snapshot.basics.email, 'updated-contact@example.com')
      assert.equal(fixed.snapshot.basics.name, sourceSnapshot.basics.name)
      assert.equal(fixed.snapshot.basics.phone, originalPhone)
      assert.equal(fixed.snapshot.basics.email, originalEmail)
    })

    await check('原空联系方式在线上仍为空', async () => {
      requireSuccess(
        await owner.client
          .from('resume_config')
          .update({
            basics: { ...sourceSnapshot.basics, phone: '', email: ' ' },
          })
          .eq('resume_id', resumeId)
          .eq('user_id', owner.id),
      )

      await updateSettings(current, false, false)

      const empty = await readShare(current)

      assert.equal(empty.snapshot.basics.phone, '')
      assert.equal(empty.snapshot.basics.email, '')
      assert.ok(!('comment_access_token' in empty))
    })
  } catch (error) {
    failure = safeFailure(stage, error)
  } finally {
    if (admin && owner) cleanup = await cleanupOwner(admin, owner, resumeId)
  }

  const ok = !failure && cleanup?.ok === true

  process.stdout.write(
    `${JSON.stringify({ ok, project: projectRef, passed: checks.length, checks, failure, cleanup, requests }, null, 2)}\n`,
  )

  if (!ok) process.exitCode = 1
}

function client(key) {
  return createClient(projectUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function requireSuccess(result) {
  if (result.error) throw result.error
}

function safeFailure(stage, error) {
  return {
    stage,
    code: error?.code ?? error?.name ?? 'unknown',
    status: error?.status ?? null,
  }
}

async function cleanupOwner(admin, owner, resumeId) {
  const errors = []
  const remaining = {}
  let userDeleted = false

  const attempt = async (stage, action) => {
    try {
      await action()
    } catch (error) {
      errors.push(safeFailure(stage, error))
    }
  }

  await attempt('删除本轮合成分享及发布批次', async () => {
    const shares = await owner.client
      .from('resume_shares')
      .select('id')
      .eq('user_id', owner.id)
      .eq('resume_id', resumeId)

    requireSuccess(shares)

    for (const share of shares.data) {
      requireSuccess(
        await owner.client.rpc('delete_resume_share_permanently', {
          p_share_id: share.id,
        }),
      )
    }
  })

  await attempt('删除本轮合成简历', async () => {
    requireSuccess(
      await admin
        .from('resume_config')
        .delete()
        .eq('user_id', owner.id)
        .eq('resume_id', resumeId),
    )
  })

  await attempt('注销合成账号会话', async () => {
    requireSuccess(await owner.client.auth.signOut())
  })

  await attempt('硬删除本轮合成账号', async () => {
    requireSuccess(await admin.auth.admin.deleteUser(owner.id, false))
  })

  for (const [table, column] of [
    ['resume_config', 'user_id'],
    ['resume_config_versions', 'user_id'],
    ['resume_comment_scopes', 'owner_user_id'],
    ['resume_shares', 'user_id'],
    ['resume_share_releases', 'created_by'],
  ]) {
    await attempt(`核对 ${table} 无残留`, async () => {
      const result = await admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq(column, owner.id)

      requireSuccess(result)
      remaining[table] = result.count
      assert.equal(result.count, 0)
    })
  }

  await attempt('核对合成账号已删除', async () => {
    const result = await admin.auth.admin.getUserById(owner.id)

    assert.equal(result.error?.status, 404)
    assert.equal(result.data.user, null)
    userDeleted = true
  })

  return {
    userId: owner.id,
    ok: errors.length === 0,
    userDeleted,
    remaining,
    errors,
  }
}

if (process.argv.includes('--run-online')) {
  await main()
} else {
  process.stdout.write(
    '脚本已准备；部署 resume-share 并审阅后传入 --run-online 执行。\n',
  )
}
