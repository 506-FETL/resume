import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.103.0'
import type { ResumeCommentAnchor } from '../shared/resume-comment-core.ts'
import {
  buildCommentAnchorDocument,
  relocateResumeCommentAnchor,
  sha256Hex,
  stableStringify,
} from '../shared/resume-comment-core.ts'
import { redactHiddenResumeSections } from '../shared/resume-share-redaction.ts'

type AdminClient = SupabaseClient

export interface SharedVersionRow {
  id: number
  resume_id: string
  user_id: string
  snapshot: unknown
  status: 'active' | 'frozen'
  document_revision: number
  projection_reference_date: string
}

export interface ShareCommentScope {
  id: string
  projectionReferenceDate: string
}

// 只选取简历公开字段，禁止把 owner、协作状态等数据库元数据带入响应。
const SNAPSHOT_FIELDS =
  'type,basics,job_intent,application_info,edu_background,work_experience,internship_experience,campus_experience,project_experience,skill_specialty,honors_certificates,self_evaluation,hobbies,order,visibility,spacing,font,theme,template_binding'

const templateCache = new Map<string, Promise<Record<string, unknown>>>()

function loadTemplateManifest(admin: AdminClient, binding: unknown) {
  const ref = binding as {
    templateId?: unknown
    templateVersion?: unknown
  } | null

  if (
    typeof ref?.templateId !== 'string' ||
    !Number.isSafeInteger(ref.templateVersion) ||
    Number(ref.templateVersion) < 1
  )
    throw new Error('Invalid current template binding')

  const key = `${ref.templateId}@${ref.templateVersion}`
  const cached = templateCache.get(key)

  if (cached) return cached

  const pending = (async () => {
    const { data, error } = await admin
      .from('official_resume_template_versions')
      .select('content,content_hash')
      .eq('template_id', ref.templateId)
      .eq('version', ref.templateVersion)
      .not('published_at', 'is', null)
      .single()

    if (error || !data || typeof data.content !== 'string')
      throw error ?? new Error('Current template is unavailable')
    if (
      new TextEncoder().encode(data.content).byteLength > 512 * 1024 ||
      sha256Hex(data.content) !== data.content_hash
    )
      throw new Error('Current template integrity check failed')

    const definition = JSON.parse(data.content)

    if (
      definition.schemaVersion !== 3 ||
      definition.renderContract !== 'declarative-page@1' ||
      definition.templateId !== ref.templateId ||
      definition.version !== ref.templateVersion ||
      !Array.isArray(definition.assets) ||
      definition.assets.length > 32
    ) {
      throw new Error('Current template identity check failed')
    }

    return {
      schemaVersion: 3,
      templateId: ref.templateId,
      templateVersion: ref.templateVersion,
      definition,
      assets: definition.assets,
    }
  })()

  templateCache.set(key, pending)

  if (templateCache.size > 32)
    templateCache.delete(templateCache.keys().next().value!)

  pending.catch(() => {
    if (templateCache.get(key) === pending) templateCache.delete(key)
  })

  return pending
}

/** 与分享展示同一份已保存配置同步评论投影；并发保存时重新读取，不回写旧正文。 */
export async function loadLiveShareSource({
  admin,
  resumeId,
  ownerUserId,
  ensureScope,
  onSync,
}: {
  admin: AdminClient
  resumeId: string
  ownerUserId: string
  ensureScope: (
    admin: AdminClient,
    version: SharedVersionRow,
  ) => Promise<ShareCommentScope>
  onSync: (scopeId: string, versionId: number, eventSeq: number) => void
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: config, error } = await admin
      .from('resume_config')
      .select(
        `${SNAPSHOT_FIELDS},display_name,updated_at,current_version_id,version:resume_config_versions!resume_config_current_version_id_fkey(id,resume_id,user_id,snapshot,status,document_revision,projection_reference_date)`,
      )
      .eq('resume_id', resumeId)
      .eq('user_id', ownerUserId)
      .single()

    if (error || !config) throw error ?? new Error('Current resume unavailable')

    const {
      display_name: displayName,
      updated_at: updatedAt,
      current_version_id: versionId,
      version: joinedVersion,
      ...snapshot
    } = config

    const version = (
      Array.isArray(joinedVersion) ? joinedVersion[0] : joinedVersion
    ) as SharedVersionRow | null

    if (
      !version ||
      version.id !== versionId ||
      version.status !== 'active' ||
      version.user_id !== ownerUserId ||
      version.resume_id !== resumeId
    )
      continue

    const manifest = await loadTemplateManifest(
      admin,
      snapshot.template_binding,
    )

    const commentScope = await ensureScope(admin, version)

    const { data: scope, error: scopeError } = await admin
      .from('resume_comment_scopes')
      .select('document_hash,document_revision')
      .eq('id', commentScope.id)
      .single()

    if (scopeError || !scope)
      throw scopeError ?? new Error('Comment scope unavailable')

    const { document, documentHash } = buildCommentAnchorDocument(
      snapshot,
      commentScope.projectionReferenceDate,
    )

    if (scope.document_revision !== version.document_revision) continue
    if (scope.document_hash !== documentHash) {
      const { data: threads, error: threadsError } = await admin
        .from('resume_comment_threads')
        .select('id,anchor')
        .eq('scope_id', commentScope.id)
        .eq('anchor_status', 'anchored')
        .is('deleted_at', null)
        .is('resolved_at', null)

      if (threadsError) throw threadsError

      const nodes = new Map(document.nodes.map((node) => [node.nodeKey, node]))

      const relocations = (threads ?? []).flatMap((thread) => {
        const anchor = thread.anchor as ResumeCommentAnchor

        const result = relocateResumeCommentAnchor(
          anchor,
          nodes.get(anchor.nodeKey),
          documentHash,
        )

        return result.status === 'detached' ||
          result.moved ||
          result.contextChanged
          ? [{ threadId: thread.id, ...result }]
          : []
      })

      const { data: synced, error: syncError } = await admin.rpc(
        'sync_live_resume_share_document',
        {
          p_resume_id: resumeId,
          p_config_updated_at: updatedAt,
          p_scope_id: commentScope.id,
          p_version_id: version.id,
          p_owner_user_id: ownerUserId,
          p_snapshot: snapshot,
          p_anchor_document: document,
          p_document_hash: documentHash,
          p_expected_document_revision: version.document_revision,
          p_projection_reference_date: commentScope.projectionReferenceDate,
          p_relocations: relocations,
          p_actor_key: `live-share:${resumeId}`,
          p_request_id: crypto.randomUUID(),
        },
      )

      if (syncError) {
        if (['P0409', 'P0002'].includes(syncError.code)) continue

        throw syncError
      }

      version.document_revision = Number(synced.documentRevision)
      onSync(commentScope.id, version.id, Number(synced.eventSeq))
    }

    const { template_binding: templateBinding, ...publicFields } = snapshot

    return {
      snapshot: redactHiddenResumeSections({
        ...publicFields,
        templateBinding,
      }),
      templateManifest: manifest,
      displayName,
      version,
      commentScope,
    }
  }

  throw new Error('Current resume changed during share read')
}

export function shareContentRevision(value: unknown) {
  return sha256Hex(stableStringify(value))
}
