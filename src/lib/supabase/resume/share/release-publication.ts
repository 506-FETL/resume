import supabase from '../../client'
import { toShareVersionSourcePatch } from '../share-version'
import type {
  ResolvedResumeShareRelease,
  ResumeShareRecord,
} from '../share.types'
import { getResumeShareRecord } from './records'

export const SHARE_PUBLISH_TIMEOUT_MS = 15_000

export const sharePublishRequests = new Map<
  string,
  Promise<ResumeShareRecord>
>()

export function toPublishError(error: unknown, timedOut: boolean): Error {
  if (timedOut) return new Error('发布超时，请稍后重试')

  const value = error as { code?: string; message?: string } | null

  if (value?.code === '55P03') return new Error('分享链接正在发布，请稍后重试')
  if (value?.message?.includes('upstream request timeout'))
    return new Error('发布超时，请稍后重试')
  if (error instanceof Error) return error

  return new Error('发布失败，请稍后重试')
}

export function toShareReleaseRpcParameters(
  release: ResolvedResumeShareRelease,
) {
  const source = toShareVersionSourcePatch(release.source)

  return {
    p_version_id: release.versionId,
    p_snapshot: release.snapshot,
    p_template_manifest: release.templateManifest,
    p_display_name: release.displayName,
    p_source_kind: source.source_kind,
    p_source_version_id: source.source_version_id,
    p_source_version_no: source.source_version_no,
    p_source_version_label: source.source_version_label,
    p_source_version_created_at: source.source_version_created_at,
    p_anchor_document: release.commentAnchorDocument,
    p_document_hash: release.commentDocumentHash,
    p_projection_reference_date: release.projectionReferenceDate,
    p_expected_document_revision: release.documentRevision,
  }
}

export async function performResumeShareReleasePublish(
  shareId: string,
  release: ResolvedResumeShareRelease,
): Promise<ResumeShareRecord> {
  const controller = new AbortController()
  let timedOut = false

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, SHARE_PUBLISH_TIMEOUT_MS)

  try {
    const { error } = await supabase
      .rpc('publish_resume_share_release', {
        ...toShareReleaseRpcParameters(release),
        p_share_id: shareId,
      })
      .abortSignal(controller.signal)

    if (error) throw error

    return await getResumeShareRecord(shareId, controller.signal)
  } catch (error) {
    throw toPublishError(error, timedOut)
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

/** 原子创建不可变 release，并切换分享链接的 current release 指针。 */
export function publishResumeShareRelease(
  shareId: string,
  release: ResolvedResumeShareRelease,
): Promise<ResumeShareRecord> {
  const pending = sharePublishRequests.get(shareId)

  if (pending) return pending

  const request = performResumeShareReleasePublish(shareId, release).finally(
    () => {
      if (sharePublishRequests.get(shareId) === request)
        sharePublishRequests.delete(shareId)
    },
  )

  sharePublishRequests.set(shareId, request)

  return request
}
