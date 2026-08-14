import type { AtsCreatePayload, AtsEvaluationResult, AtsPersistPatch, AtsRecordId, FindingsGroup, FixChecklistItem, Summary } from '@/lib/schema/ats'
import supabase from '../client'
import { getCurrentUser } from '../user'
import { sanitizeAtsPersistInput } from './utils'

export interface AtsSummaryRecord {
  id: AtsRecordId
  resume_id: string
  created_at: string
  todo_items: string[]
  findings: FindingsGroup | null
  summary: Pick<Summary, 'overall_score'> | null
}

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

export async function listAtsSummaries() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登录')
  }

  const { data, error } = await supabase
    .from('ats')
    .select('id,resume_id,created_at,todo_items,findings,summary')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AtsSummaryRecord[]
}

export async function updateAtsConfig(id: AtsRecordId, payload: AtsPersistPatch) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登录')
  }

  const safePayload = sanitizeAtsPersistInput(payload)

  const { error } = await supabase
    .from('ats')
    .update(safePayload)
    .eq('user_id', user.id)
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function createAtsConfig(payload: AtsCreatePayload) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登录')
  }

  const safePayload = sanitizeAtsPersistInput(payload)

  if (!safePayload.resume_id) {
    throw new Error('缺少 resume_id，无法保存 ATS 报告')
  }

  const { data, error } = await supabase
    .from('ats')
    .insert({
      ...safePayload,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as AtsEvaluationResult
}

export async function updateFixChecklist(fixChecklist: FixChecklistItem[], id: AtsRecordId) {
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
