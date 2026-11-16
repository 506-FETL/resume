import supabase from '../../../client'
import { getCurrentUser } from '../../../user'
import type {
  CreateResumeHistoryVersionInput,
  ResumeHistoryVersionListRow,
  ResumeHistoryVersionRow,
  UpdateResumeHistoryVersionInput,
} from '../types'
import { VERSION_LIST_SELECTOR, VERSION_SELECTOR } from './selectors'

export async function createNextResumeVersion(
  resumeId: string,
  versionName: string | null,
) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const { data, error } = await supabase.rpc('create_next_resume_version', {
    p_resume_id: resumeId,
    p_version_name: versionName?.trim() || null,
  })

  if (error) throw error

  const versionId = Number(data)

  if (!Number.isSafeInteger(versionId) || versionId <= 0)
    throw new Error('新版本创建结果无效')

  return versionId
}

export async function createResumeHistoryVersion(
  input: CreateResumeHistoryVersionInput,
) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { data, error } = await supabase
    .from('resume_config_versions')
    .insert({
      resume_id: input.resume_id,
      version_name: input.version_name ?? null,
      description: input.description ?? null,
      milestone_name: input.milestone_name ?? null,
      source_type: input.source_type ?? 'manual',
      tags: input.tags ?? [],
      snapshot: input.snapshot,
      content_hash: input.content_hash ?? null,
      base_updated_at: input.base_updated_at ?? null,
      company_id: input.company_id ?? null,
      submitted_at: input.submitted_at ?? null,
      status: 'frozen',
      projection_reference_date: new Date().toISOString().slice(0, 10),
    })
    .select(VERSION_SELECTOR)
    .single()

  if (error) {
    throw error
  }

  return data as ResumeHistoryVersionRow
}

export async function updateResumeHistoryVersion(
  id: number,
  input: UpdateResumeHistoryVersionInput,
) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { data, error } = await supabase
    .from('resume_config_versions')
    .update({
      version_name: input.version_name ?? null,
      description: input.description ?? null,
      milestone_name: input.milestone_name ?? null,
      tags: input.tags ?? [],
      company_id: input.company_id ?? null,
      submitted_at: input.submitted_at ?? null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select(VERSION_LIST_SELECTOR)
    .single()

  if (error) {
    throw error
  }

  return data as ResumeHistoryVersionListRow
}

export async function deleteResumeHistoryVersion(id: number) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登陆')
  }

  const { error } = await supabase.rpc(
    'delete_resume_history_version_with_comments',
    {
      p_history_version_id: id,
    },
  )

  if (error) {
    throw error
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('resume-history-version-deleted', {
        detail: { historyVersionId: id },
      }),
    )
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('resume-history-events')

    channel.postMessage({
      type: 'history-version-deleted',
      historyVersionId: id,
    })

    channel.close()
  }
}
