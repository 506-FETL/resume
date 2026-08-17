import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { isCloudResumeId, ResumeNotFoundError } from '@/lib/resume-id'
import supabase from '../client'
import { getCurrentUser } from '../user'

export async function updateResumeConfig(resumeId: string, data: Record<string, any>) {
  if (!isCloudResumeId(resumeId))
    throw new ResumeNotFoundError()

  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const { error } = await supabase
    .from('resume_config')
    .update(data)
    .eq('resume_id', resumeId)
    .eq('user_id', user.id)

  if (error)
    throw error
}

export async function subscribeToResumeConfigUpdates(
  callback: (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => void,
) {
  const user = await getCurrentUser()

  if (!user)
    throw new Error('用户未登陆')

  const channel = supabase
    .channel(`resume_config_changes:${user.id}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'resume_config', filter: `user_id=eq.${user.id}` },
      (payload) => {
        callback(payload)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
