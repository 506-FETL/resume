import supabase from '../../client'
import { getDatabaseFunctionUrl } from '../../edge-functions'

/** 撤销 / 启用 */
export async function setResumeShareActive(shareId: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('resume_shares')
    .update({ is_active: isActive })
    .eq('id', shareId)
    .select('is_active,updated_at')
    .single()

  if (error) throw error

  return data
}

export async function updateResumeShareSettings(
  shareId: string,
  settings: {
    label: string | null
    expiresAt: string | null
    password: string | null | undefined
    allowComments: boolean
    showPhone?: boolean
    showEmail?: boolean
    activate?: true
  },
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token

  if (!token) throw new Error('用户未登录')

  const response = await fetch(getDatabaseFunctionUrl('resume-share'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      op: 'update_settings',
      shareId,
      label: settings.label,
      expiresAt: settings.expiresAt,
      allowComments: settings.allowComments,
      showPhone: settings.showPhone,
      showEmail: settings.showEmail,
      activate: settings.activate,
      ...(settings.password !== undefined
        ? { password: settings.password }
        : {}),
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')

    throw new Error(`更新分享设置失败: ${text}`)
  }
}

export async function archiveResumeShare(shareId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_resume_share', {
    p_share_id: shareId,
  })

  if (error) throw error
}

export async function deleteResumeShare(shareId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_resume_share_permanently', {
    p_share_id: shareId,
  })

  if (error) throw error
}
