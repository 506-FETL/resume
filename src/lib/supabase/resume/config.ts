import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { notifyResumeReadChanged } from '@/lib/resume-read-events'
import { isCloudResumeId, ResumeNotFoundError } from '@/lib/resume-id'
import supabase from '../client'
import { getCurrentUser } from '../user'

export async function updateResumeConfig(
  resumeId: string,
  data: Record<string, any>,
  expectedUpdatedAt?: string | null,
) {
  const userId = await getResumeOwnerId(resumeId)

  const query = supabase
    .from('resume_config')
    .update(data)
    .eq('resume_id', resumeId)
    .eq('user_id', userId)

  if (expectedUpdatedAt === undefined) {
    const { error } = await query

    if (error) throw error

    notifyResumeReadChanged(resumeId)
  } else {
    const versioned =
      expectedUpdatedAt === null
        ? query.is('updated_at', null)
        : query.eq('updated_at', expectedUpdatedAt)

    const { data: saved, error } = await versioned
      .select('resume_id,display_name,updated_at')
      .maybeSingle()

    if (error) throw error
    if (!saved) throw new Error('简历已更新，请重新读取后再应用')

    notifyResumeReadChanged(resumeId, { owner: userId, label: saved })
  }
}

export async function updateResumeLibraryMeta(
  resumeId: string,
  fields: { display_name: string | null; description: string | null },
) {
  const userId = await getResumeOwnerId(resumeId)

  const { data, error } = await supabase
    .from('resume_config')
    .update(fields)
    .eq('resume_id', resumeId)
    .eq('user_id', userId)
    .select('display_name,description,updated_at')
    .single()

  if (error) throw error

  notifyResumeReadChanged(resumeId)

  return data
}

async function getResumeOwnerId(resumeId: string) {
  if (!isCloudResumeId(resumeId)) throw new ResumeNotFoundError()

  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  return user.id
}

export async function subscribeToResumeConfigUpdates(
  callback: (
    payload: RealtimePostgresChangesPayload<{ [key: string]: any }>,
  ) => void,
) {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登陆')

  const channel = supabase
    .channel(`resume_config_changes:${user.id}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'resume_config',
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        callback(payload)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function saveRestoredResumeConfig(
  resumeId: string,
  fields: Record<string, unknown>,
) {
  const owner = await getResumeOwnerId(resumeId)

  const { data, error } = await supabase
    .from('resume_config')
    .update(fields)
    .eq('resume_id', resumeId)
    .eq('user_id', owner)
    .select('resume_id,display_name,description,updated_at,type')
    .single()

  if (error) throw error

  notifyResumeReadChanged(resumeId, { owner, label: data })

  return data
}
