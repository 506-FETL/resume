import {
  PERSISTED_VALUE_TYPES,
  SUGGESTION_KINDS,
} from '@/lib/ats/result/values'
import type { ResumeHistoryVersionSummaryRecord } from '@/lib/supabase/resume/history/types'
import supabase from '@/lib/supabase/client'
import { dashboardDayStarts } from '../../utils'

type AtsSummaryRow = {
  assessed_count: number
  scored_count: number
  score_sum: number | null
  pending_count: number
}

type TrendScore = { created_at: string; overall_score: number }

type ActivityVersion = Pick<
  ResumeHistoryVersionSummaryRecord,
  'resume_id' | 'version_no' | 'created_at' | 'source_type'
> & { resume: { display_name: string | null } }

export async function getDashboardAtsSummary(owner: string) {
  const { data, error } = await supabase
    .rpc('get_dashboard_ats_summary', {
      p_owner_id: owner,
      p_suggestion_kinds: [...SUGGESTION_KINDS],
      p_value_types: [...PERSISTED_VALUE_TYPES],
    })
    .single<AtsSummaryRow>()

  if (error) throw error

  return {
    atsResumeCount: data.assessed_count,
    scoredResumeCount: data.scored_count,
    avgAtsScore:
      data.score_sum === null
        ? null
        : Math.round(data.score_sum / data.scored_count),
    atsTodoTotal: data.pending_count,
  }
}

export async function listDashboardTrend(owner: string) {
  const { data, error } = await supabase.rpc('get_dashboard_ats_trend', {
    p_owner_id: owner,
  })

  if (error) throw error
  if (!Array.isArray(data)) throw new Error('ATS 评分趋势读取失败')

  return data as TrendScore[]
}

export async function listDashboardVersions(owner: string) {
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

export async function loadDashboardWeeklyEdits(owner: string) {
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
