import type { AdminClient, ScopeRow } from './types.ts'
import { CommentApiError } from '../shared/resume-comment-schema.ts'
import { buildCommentAnchorDocument } from '../shared/resume-comment-core.ts'

export async function getScope(
  admin: AdminClient,
  scopeId: string,
): Promise<ScopeRow> {
  const { data, error } = await admin
    .from('resume_comment_scopes')
    .select(
      'id,kind,owner_user_id,resume_id,version_id,history_version_id,share_release_id,anchor_document,document_hash,document_revision,projection_reference_date,next_event_seq,archived_at',
    )
    .eq('id', scopeId)
    .maybeSingle()

  if (error || !data) {
    throw new CommentApiError('not_found', '评论空间不存在', 404)
  }

  return data as ScopeRow
}

export async function ensureVersionScopeForOwner(
  admin: AdminClient,
  ownerUserId: string,
  versionId: number,
) {
  const { data: existing, error: existingError } = await admin
    .from('resume_comment_scopes')
    .select(
      'id,kind,owner_user_id,resume_id,version_id,history_version_id,share_release_id,anchor_document,document_hash,document_revision,projection_reference_date,next_event_seq,archived_at',
    )
    .eq('kind', 'version')
    .eq('version_id', versionId)
    .eq('owner_user_id', ownerUserId)
    .is('archived_at', null)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing?.id) return existing as ScopeRow

  const { data: version, error } = await admin
    .from('resume_config_versions')
    .select(
      'id,resume_id,user_id,snapshot,projection_reference_date,document_revision',
    )
    .eq('id', versionId)
    .eq('user_id', ownerUserId)
    .maybeSingle()

  if (error || !version) {
    throw new CommentApiError('not_found', '简历版本不存在', 404)
  }

  const projectionReferenceDate = String(version.projection_reference_date)

  const projected = buildCommentAnchorDocument(
    version.snapshot,
    projectionReferenceDate,
  )

  const { data, error: ensureError } = await admin.rpc(
    'ensure_resume_version_comment_scope',
    {
      p_owner_user_id: ownerUserId,
      p_version_id: version.id,
      p_anchor_document: projected.document,
      p_document_hash: projected.documentHash,
      p_projection_reference_date: projectionReferenceDate,
      p_expected_document_revision: version.document_revision,
    },
  )

  if (ensureError || typeof data !== 'string')
    throw ensureError ?? new Error('Unable to ensure version comment scope')

  return getScope(admin, data)
}

export async function resolveCurrentVersionId(
  admin: AdminClient,
  ownerUserId: string,
  resumeId: string,
) {
  const { data, error } = await admin
    .from('resume_config')
    .select('current_version_id')
    .eq('resume_id', resumeId)
    .eq('user_id', ownerUserId)
    .maybeSingle()

  const versionId = Number(data?.current_version_id)

  if (error || !Number.isSafeInteger(versionId) || versionId <= 0)
    throw new CommentApiError('not_found', '简历当前版本不存在', 404)

  return versionId
}

export async function loadPersistedResumeSnapshot(
  admin: AdminClient,
  ownerUserId: string,
  resumeId: string,
) {
  const { data, error } = await admin
    .from('resume_config')
    .select(
      'type,basics,job_intent,application_info,edu_background,work_experience,internship_experience,campus_experience,project_experience,skill_specialty,honors_certificates,self_evaluation,hobbies,order,visibility,spacing,font,theme,template_binding',
    )
    .eq('resume_id', resumeId)
    .eq('user_id', ownerUserId)
    .maybeSingle()

  if (error || !data) throw new CommentApiError('not_found', '简历不存在', 404)

  return data
}
