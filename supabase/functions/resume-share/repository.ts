import type { CurrentReleaseRow, AdminClient } from './types.ts'
import type { SharedVersionRow } from './live-source.ts'
import { buildCommentAnchorDocument } from '../shared/resume-comment-core.ts'
import { redactHiddenResumeSections } from '../shared/resume-share-redaction.ts'

export function readCurrentRelease(value: unknown): CurrentReleaseRow | null {
  const release = (
    Array.isArray(value) ? value[0] : value
  ) as CurrentReleaseRow | null

  return release?.id && Number.isInteger(release.release_no) ? release : null
}

export async function verifyShareOwnership(
  admin: AdminClient,
  shareId: string,
  userId: string,
) {
  const { data, error } = await admin
    .from('resume_shares')
    .select('id')
    .eq('id', shareId)
    .eq('user_id', userId)
    .maybeSingle()

  return !error && Boolean(data)
}

export async function consumeOwnerWriteLimit(
  admin: AdminClient,
  userId: string,
) {
  const { data, error } = await admin.rpc('consume_resume_share_owner_write', {
    p_user_id: userId,
    p_limit: 30,
    p_window_seconds: 60,
    p_block_seconds: 60,
  })

  return !error && Boolean(data)
}

export async function ensureShareCommentScope(
  admin: AdminClient,
  version: SharedVersionRow,
) {
  const { data: existing, error: existingError } = await admin
    .from('resume_comment_scopes')
    .select('id,projection_reference_date,document_hash,document_revision')
    .eq('kind', 'version')
    .eq('version_id', version.id)
    .is('archived_at', null)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }
  if (existing?.id) {
    return {
      id: existing.id as string,
      projectionReferenceDate: String(existing.projection_reference_date),
      documentHash: existing.document_hash as string,
      documentRevision: existing.document_revision as number,
    }
  }

  const referenceDate = version.projection_reference_date

  const { data: savedVersion, error: versionError } = await admin
    .from('resume_config_versions')
    .select('snapshot')
    .eq('id', version.id)
    .eq('user_id', version.user_id)
    .eq('resume_id', version.resume_id)
    .single()

  if (versionError || !savedVersion)
    throw versionError ?? new Error('Shared version unavailable')

  const { document, documentHash } = buildCommentAnchorDocument(
    savedVersion.snapshot,
    referenceDate,
  )

  const { data, error } = await admin.rpc(
    'ensure_resume_version_comment_scope',
    {
      p_owner_user_id: version.user_id,
      p_version_id: version.id,
      p_anchor_document: document,
      p_document_hash: documentHash,
      p_projection_reference_date: referenceDate,
      p_expected_document_revision: version.document_revision,
    },
  )

  if (error || typeof data !== 'string')
    throw error ?? new Error('Unable to ensure version comment scope')

  const { data: scope, error: scopeError } = await admin
    .from('resume_comment_scopes')
    .select('id,projection_reference_date,document_hash,document_revision')
    .eq('id', data)
    .single()

  if (scopeError || !scope)
    throw scopeError ?? new Error('Comment scope unavailable')

  return {
    id: scope.id as string,
    projectionReferenceDate: String(scope.projection_reference_date),
    documentHash: scope.document_hash as string,
    documentRevision: scope.document_revision as number,
  }
}

export async function loadReleasedShareSource(
  admin: AdminClient,
  release: CurrentReleaseRow,
  version: SharedVersionRow,
) {
  const [{ data, error }, commentScope] = await Promise.all([
    admin
      .from('resume_share_releases')
      .select('snapshot,template_manifest')
      .eq('id', release.id)
      .single(),
    ensureShareCommentScope(admin, version),
  ])

  if (error || !data) throw error ?? new Error('Share release unavailable')

  return {
    snapshot: redactHiddenResumeSections(data.snapshot),
    templateManifest: data.template_manifest,
    displayName: release.display_name,
    version,
    commentScope,
  }
}
