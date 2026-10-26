import supabase from '../client'
import { getCurrentUser } from '../user'

export interface ExtractedJobProfile {
  company: string | null
  position: string | null
  location: string | null
  salary: string | null
  source: string | null
}

export async function extractJobProfile(
  jdText: string,
  signal?: AbortSignal,
): Promise<ExtractedJobProfile> {
  if (!jdText.trim()) throw new Error('请先粘贴 JD 原文')
  if (jdText.length > 30_000) throw new Error('JD 最多 30,000 字符')

  const user = await getCurrentUser()

  if (!user) throw new Error('请先登录')

  const { data, error } = await supabase.functions.invoke('job-profile', {
    body: { text: jdText },
    signal,
  })

  if (error) {
    const detail = await error.context?.json?.().catch(() => null)

    throw new Error(
      detail?.error ?? '暂时无法识别，JD 已保留，可重试或手动填写',
    )
  }

  return data.profile as ExtractedJobProfile
}
