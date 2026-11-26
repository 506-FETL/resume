import { readJobContext } from '@/lib/job-context'
import { sharePurposeDefaults } from '@/lib/share-purpose'
import { mapSourceToPersistedSnapshot } from '@/store/resume/helpers'
import supabase from '../../client'
import { getCurrentUser } from '../../user'
import { getResumeById, RESUME_PERSISTED_SELECTOR } from '../form'
import { createResumeHistoryVersion } from '../history/queries'
import type {
  CreateShareOptions,
  CreateShareReleaseSource,
  ResumeShareRecord,
} from '../share.types'
import { deleteResumeShare, updateResumeShareSettings } from './owner-actions'
import { getResumeShareRecord } from './records'
import {
  SHARE_PUBLISH_TIMEOUT_MS,
  toPublishError,
  toShareReleaseRpcParameters,
} from './release-publication'
import { resolveHistoryResumeShareRelease } from './release-source'

export function generateToken() {
  // 64 位十六进制随机串（两段 uuid 去横线拼接），足够长以抵抗枚举
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
}

/** 创建带明确版本来源的分享链接（owner）。 */
export async function createResumeShareRelease(
  resumeId: string,
  release: CreateShareReleaseSource,
  options: CreateShareOptions = {},
): Promise<ResumeShareRecord> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  const policy = {
    ...sharePurposeDefaults(options.purpose ?? 'review'),
    ...options,
  }

  const job = options.jobId ? await readJobContext(options.jobId) : null

  if (job && job.resumeId !== resumeId)
    throw new Error('岗位准备中的简历已更换，请重新打开分享')

  if (
    release === 'saved-current' ||
    (policy.purpose === 'application' && release.source.kind === 'current')
  ) {
    if (policy.purpose !== 'application')
      throw new Error('只有正式投递分享可以创建固定版本')

    const savedRow = await getResumeById<Record<string, unknown>>(
      resumeId,
      `${RESUME_PERSISTED_SELECTOR},display_name`,
    )

    const savedSnapshot = mapSourceToPersistedSnapshot(savedRow ?? {})

    const savedDisplayName =
      typeof savedRow?.display_name === 'string' ? savedRow.display_name : null

    const version = await createResumeHistoryVersion({
      resume_id: resumeId,
      version_name: job
        ? `用于投递${job.company}的版本`
        : options.label?.trim() || '用于正式投递的版本',
      company_id: job?.id ?? null,
      snapshot: savedSnapshot,
    })

    release = await resolveHistoryResumeShareRelease(
      version.id,
      version,
      savedDisplayName,
    )
  }

  const token = generateToken()
  const hasPassword = Boolean(options.password)

  const allowComments =
    policy.purpose === 'showcase' || !policy.showPhone || !policy.showEmail
      ? false
      : policy.allowComments

  const controller = new AbortController()
  let timedOut = false
  let shareId: string

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, SHARE_PUBLISH_TIMEOUT_MS)

  try {
    const { data, error } = await supabase
      .rpc('create_resume_share_release', {
        ...toShareReleaseRpcParameters(release),
        p_resume_id: resumeId,
        p_token: token,
        p_label: options.label ?? null,
        p_expires_at: options.expiresAt ?? null,
        p_purpose: policy.purpose,
        p_show_phone: policy.showPhone,
        p_show_email: policy.showEmail,
        p_allow_comments: allowComments,
        p_activate: !hasPassword,
      })
      .abortSignal(controller.signal)

    if (error) throw error

    shareId = data
  } catch (error) {
    throw toPublishError(error, timedOut)
  } finally {
    globalThis.clearTimeout(timeoutId)
  }

  try {
    if (hasPassword) {
      await updateResumeShareSettings(shareId, {
        label: options.label ?? null,
        expiresAt: options.expiresAt ?? null,
        password: options.password!,
        allowComments,
        activate: true,
      })
    }

    return await getResumeShareRecord(shareId)
  } catch (error) {
    await deleteResumeShare(shareId).catch(() => undefined)

    throw error
  }
}
