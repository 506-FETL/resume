import { buildCommentAnchorDocument } from '@/features/resume-comments/anchors/document.ts'
import {
  isResumeCommentClientError,
  ResumeCommentClient,
} from '@/features/resume-comments/api/client.ts'
import { resolveTemplate } from '@/lib/resume-template/runtime/resolve-template'
import { serializeTemplateForShare } from '@/lib/resume-template/share'
import { resumeTemplateSource } from '@/lib/resume-template/source'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers'
import { redactHiddenResumeSections } from '../../../../../supabase/functions/shared/resume-share-redaction.ts'
import { getResumeById, RESUME_PERSISTED_SELECTOR } from '../form'
import {
  getCurrentResumeVersion,
  getResumeVersionForShare,
} from '../history/queries'
import type { ResumeHistoryShareReleaseRow } from '../history/types'
import type {
  CurrentResumeShareSnapshotProvider,
  ResolvedResumeShareRelease,
  ResumeShareSnapshotSource,
  ShareVersionSelection,
} from '../share.types'

/** 从云端简历配置构造完整快照（列表卡片场景：页面未加载文档） */
export async function buildResumeShareSnapshotSource(
  snapshot: PersistedResumeSnapshot,
  displayName: string | null,
): Promise<ResumeShareSnapshotSource> {
  const publicSnapshot = redactHiddenResumeSections(snapshot)

  const definition = await resolveTemplate(
    resumeTemplateSource,
    snapshot.templateBinding,
  )

  return {
    snapshot: publicSnapshot,
    templateManifest: serializeTemplateForShare(definition),
    displayName,
  }
}

export async function getResumeSnapshotById(
  resumeId: string,
): Promise<ResumeShareSnapshotSource> {
  const source = await getResumeById<Record<string, unknown>>(
    resumeId,
    `${RESUME_PERSISTED_SELECTOR},display_name`,
  )

  const snapshot = mapSourceToPersistedSnapshot(source ?? {})

  const displayName =
    (source as { display_name?: string | null } | null)?.display_name ?? null

  return buildResumeShareSnapshotSource(snapshot, displayName)
}

export async function resolveResumeShareRelease(input: {
  resumeId: string
  displayName: string | null
  selection: ShareVersionSelection
  getCurrentSource: CurrentResumeShareSnapshotProvider
}): Promise<ResolvedResumeShareRelease> {
  if (input.selection.kind === 'current') {
    // 当前快照提供者会先完成编辑器保存；工作版本只负责评论身份，
    // 其正文哈希不包含模板、字体和配色，不能用它还原当前外观。
    const source = await input.getCurrentSource(input.resumeId)

    for (let attempt = 0; attempt < 3; attempt++) {
      const version = await getCurrentResumeVersion(input.resumeId)

      const commentAnchor = buildCommentAnchorDocument(
        source.snapshot,
        version.projection_reference_date,
      )

      const versionAnchor = buildCommentAnchorDocument(
        mapSourceToPersistedSnapshot(version.snapshot),
        version.projection_reference_date,
      )

      if (commentAnchor.documentHash === versionAnchor.documentHash) {
        return {
          ...source,
          source: { kind: 'current' },
          versionId: version.id,
          documentRevision: version.document_revision,
          projectionReferenceDate: version.projection_reference_date,
          commentAnchorDocument: commentAnchor.document,
          commentDocumentHash: commentAnchor.documentHash,
        }
      }
      if (attempt === 2) break

      // 列表和分享管理没有编辑器监听者，必要时补齐已保存正文的评论版本。
      const client = new ResumeCommentClient({
        kind: 'owner',
        resumeId: input.resumeId,
      })

      try {
        await client.syncWorkingDocument({
          anchorDocument: commentAnchor.document,
          documentHash: commentAnchor.documentHash,
          projectionReferenceDate: version.projection_reference_date,
          expectedDocumentRevision: version.document_revision,
        })
      } catch (error) {
        if (
          !isResumeCommentClientError(error) ||
          error.code !== 'stale_document'
        )
          throw error
      }
    }

    throw new Error('简历内容正在变化，请保存完成后重新发布分享')
  }

  const version = await getResumeVersionForShare(
    input.resumeId,
    input.selection.versionId,
  )

  return resolveHistoryResumeShareRelease(
    input.selection.versionId,
    version,
    input.displayName,
  )
}

export async function resolveHistoryResumeShareRelease(
  versionId: number,
  version: ResumeHistoryShareReleaseRow,
  displayName: string | null,
): Promise<ResolvedResumeShareRelease> {
  const snapshot = mapSourceToPersistedSnapshot(version.snapshot)

  const source = await buildResumeShareSnapshotSource(snapshot, displayName)

  const commentAnchor = buildCommentAnchorDocument(
    snapshot,
    version.projection_reference_date,
  )

  return {
    ...source,
    source: {
      kind: 'history',
      versionId,
      versionNo: version.version_no,
      versionLabel:
        version.version_name?.trim() ||
        version.milestone_name?.trim() ||
        '未命名版本',
      versionCreatedAt: version.created_at,
    },
    versionId,
    documentRevision: version.document_revision,
    projectionReferenceDate: version.projection_reference_date,
    commentAnchorDocument: commentAnchor.document,
    commentDocumentHash: commentAnchor.documentHash,
  }
}
