import type { AtsReportSummary } from '@/lib/supabase/resume/ats'
import {
  PERSISTED_VALUE_TYPES,
  SUGGESTION_KINDS,
} from '@/lib/ats/result/values'
import type { ResumeHistoryVersionSummaryRecord } from '@/lib/supabase/resume/history/types'
import supabase from '@/lib/supabase/client'
import { collectPages } from '@/lib/supabase/pagination'
import { getCurrentUser } from '@/lib/supabase/user'
import { dashboardDayStarts } from '../../utils'

type LatestAssessment = Pick<
  AtsReportSummary,
  'resume_id' | 'overall_score'
> & {
  pending_count: number
}

type TrendScore = { created_at: string; overall_score: number }

type ActivityVersion = Pick<
  ResumeHistoryVersionSummaryRecord,
  'resume_id' | 'version_no' | 'created_at' | 'source_type'
> & { resume: { display_name: string | null } }

async function currentOwner() {
  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  return user.id
}

export async function listDashboardAssessments() {
  const owner = await currentOwner()

  return collectPages(async (from, to) => {
    const { data, error } = await supabase.rpc(
      'get_dashboard_ats_assessments',
      {
        p_owner_id: owner,
        p_offset: from,
        p_limit: to - from + 1,
        p_suggestion_kinds: [...SUGGESTION_KINDS],
        p_value_types: [...PERSISTED_VALUE_TYPES],
      },
    )

    if (error) throw error

    return data as LatestAssessment[]
  }, 500)
}

export async function listDashboardTrend() {
  const owner = await currentOwner()
  const scores: TrendScore[] = []

  for (let offset = 0; scores.length < 8; ) {
    const pageSize = offset === 0 ? 8 : 200

    const { data, error } = await supabase
      .from('ats')
      .select(
        'created_at,overall_score:summary->overall_score,resume_config!ats_resume_id_fkey!inner()',
      )
      .eq('user_id', owner)
      .eq('resume_config.user_id', owner)
      .not('summary->>overall_score', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    for (const row of data) {
      if (typeof row.overall_score === 'number')
        scores.push({
          created_at: row.created_at,
          overall_score: row.overall_score,
        })

      if (scores.length === 8) break
    }

    if (data.length < pageSize) break

    offset += data.length
  }

  return scores.reverse()
}

export async function listDashboardVersions() {
  const owner = await currentOwner()

  const { data, error } = await supabase
    .from('resume_config_versions')
    .select(
      'resume_id,version_no,created_at,source_type,resume:resume_config!resume_config_versions_resume_id_fkey!inner(display_name)',
    )
    .eq('user_id', owner)
    .eq('resume.user_id', owner)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(5)
    .overrideTypes<ActivityVersion[], { merge: false }>()

  if (error) throw error

  return data
}

export async function loadDashboardWeeklyEdits() {
  const owner = await currentOwner()
  const starts = dashboardDayStarts().map((date) => date.toISOString())

  const { data, error } = await supabase.rpc('get_dashboard_version_edits', {
    p_owner_id: owner,
    p_day_starts: starts,
  })

  if (error) throw error
  if (
    !Array.isArray(data) ||
    data.length !== 7 ||
    !data.every((count) => Number.isSafeInteger(count) && count >= 0)
  )
    throw new Error('本周编辑次数读取失败')

  return Object.fromEntries<number>(
    data.map((count, index) => [starts[index], count]),
  )
}
