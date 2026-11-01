import type {
  AtsCreatePayload,
  AtsEvaluationResult,
  AtsPersistPatch,
  AtsRecordId,
  FindingsGroup,
  FixChecklistItem,
  Summary,
} from '@/lib/schema/ats'
import supabase from '../client'
import { collectPages } from '../pagination'
import { getCurrentUser } from '../user'
import { sanitizeAtsPersistInput } from './utils'

export interface AtsSummaryRecord {
  id: AtsRecordId
  resume_id: string
  created_at: string
  findings: FindingsGroup | null
  summary: Pick<Summary, 'overall_score'> | null
}

export async function getAtsFromUserId(resumeId?: string) {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登录')
  }

  return collectPages(async (from, to) => {
    let query = supabase
      .from('ats')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (resumeId) query = query.eq('resume_id', resumeId)

    const { data, error } = await query

    if (error) throw error

    return data as AtsEvaluationResult[]
  })
}

export interface AtsReportSummary {
  id: AtsRecordId
  resume_id: string
  created_at: string
  overall_score: number | null
}

async function readAtsReportSummaries(
  userId: string,
  latest = false,
): Promise<AtsReportSummary[]> {
  const rows: AtsReportSummary[] = []
  const pageSize = 500

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(latest ? 'latest_ats_reports' : 'ats')
      .select(
        latest
          ? 'id,resume_id,created_at,overall_score'
          : 'id,resume_id,created_at,overall_score:summary->overall_score',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    rows.push(...(data as AtsReportSummary[]))

    if (data.length < pageSize) break
  }

  return rows
}

export async function listLatestAtsReportSummaries(): Promise<
  AtsReportSummary[]
> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  return readAtsReportSummaries(user.id, true)
}

export async function getLatestAtsReport(
  resumeId?: string | null,
): Promise<AtsEvaluationResult | null> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  let query = supabase
    .from('ats')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)

  if (resumeId) query = query.eq('resume_id', resumeId)

  const { data, error } = await query.maybeSingle()

  if (error) throw error

  return data as AtsEvaluationResult | null
}

export async function getAtsReport(
  id: AtsRecordId,
): Promise<AtsEvaluationResult> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('ats')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) throw error

  return data as AtsEvaluationResult
}

export async function listAtsSummaries(): Promise<AtsSummaryRecord[]> {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  const [summaries, latestFindings] = await Promise.all([
    readAtsReportSummaries(user.id),
    readLatestAtsFindings(user.id),
  ])

  const findings = new Map(latestFindings.map((row) => [row.id, row.findings]))

  return summaries.map(({ overall_score, ...row }) => ({
    ...row,
    summary: overall_score === null ? null : { overall_score },
    findings: findings.get(row.id) ?? null,
  }))
}

async function readLatestAtsFindings(userId: string) {
  const rows: { id: AtsRecordId; findings: FindingsGroup | null }[] = []
  const pageSize = 500

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('latest_ats_reports')
      .select('id,findings')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    rows.push(...data)

    if (data.length < pageSize) break
  }

  return rows
}

export async function updateAtsConfig(
  id: AtsRecordId,
  payload: AtsPersistPatch,
) {
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

export async function updateFixChecklist(
  fixChecklist: FixChecklistItem[],
  id: AtsRecordId,
) {
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
