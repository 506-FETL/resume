import type { AtsEvaluationResult } from '../../../pages/optimize/types'
import type { FixChecklistItem } from '@/pages/optimize/types'
import supabase from '../client'
import { getCurrentUser } from '../user'

export async function getAtsFromUserId() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登录')
  }

  const { data, error } = await supabase
    .from('ats')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  return data as AtsEvaluationResult[]
}

export async function updateFixChecklist(fixChecklist: FixChecklistItem[], id: string) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登录')
  }

  const { error } = await supabase
    .from('ats')
    .update({ fixChecklist })
    .eq('user_id', user.id)
    .eq('id', id)

  if (error) {
    throw error
  }
}
