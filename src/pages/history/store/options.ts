import { createOptionWindow } from './option-window'
import supabase from '@/lib/supabase/client'
import { normalizeResumeType } from '@/lib/schema/resume/resume-type'
import { subscribeResumeReadChanges } from '@/lib/resume-read-events'
import useUserStore from '@/store/user'

export const useResumeOptions = createOptionWindow(
  async (owner, offset, limit) => {
    const { data, error } = await supabase
      .from('resume_config')
      .select('resume_id,display_name,type,updated_at')
      .eq('user_id', owner)
      .order('updated_at', { ascending: false })
      .order('resume_id', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return data.map((row) => ({
      resumeId: row.resume_id,
      displayName: row.display_name?.trim() || '未命名简历',
      type: normalizeResumeType(row.type),
      updatedAt: row.updated_at,
    }))
  },
)

export const useJobOptions = createOptionWindow(
  async (owner, offset, limit) => {
    const { data, error } = await supabase
      .from('company')
      .select('id,company,position')
      .eq('user_id', owner)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return data
  },
)

export function resetHistoryOptions() {
  useResumeOptions.getState().reset()
  useJobOptions.getState().reset()
}

useUserStore.subscribe((state, previous) => {
  if (state.currentUser?.id !== previous.currentUser?.id) resetHistoryOptions()
})

subscribeResumeReadChanges(() => useResumeOptions.getState().reset())
