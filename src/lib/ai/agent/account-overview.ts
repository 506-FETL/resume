import { getDB } from '@/lib/offline-resume-manager/database'
import { getOfflineResumeSummaries } from '@/lib/offline-resume-manager/queries'
import supabase from '@/lib/supabase/client'

const RESUME_SAMPLE_SIZE = 10

export async function readResumeOverview(ownerId: string | null) {
  const [cloud, localCount] = await Promise.all([
    ownerId
      ? supabase
          .from('resume_config')
          .select('resume_id,display_name,type', { count: 'exact' })
          .eq('user_id', ownerId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(RESUME_SAMPLE_SIZE)
      : { data: [], count: 0, error: null },
    getDB().then((db) => db.count('resumes')),
  ])

  if (cloud.error) throw cloud.error
  if (cloud.count === null) throw new Error('未能读取简历数量')

  const items = (cloud.data ?? []).map((row) => ({
    id: row.resume_id,
    name: row.display_name,
    type: row.type,
    storage: 'cloud',
  }))

  const remaining = RESUME_SAMPLE_SIZE - items.length

  if (remaining > 0 && localCount > 0) {
    const local = await getOfflineResumeSummaries(remaining)

    items.push(
      ...local.map((row) => ({
        id: row.resume_id,
        name: row.display_name,
        type: row.type,
        storage: 'local',
      })),
    )
  }

  return { total: cloud.count + localCount, items }
}

export async function readJobOverview(ownerId: string | null) {
  if (!ownerId) throw new Error('用户未登录')

  const { data, error } = await supabase.rpc('get_assistant_job_counts', {
    p_owner_id: ownerId,
  })

  if (error) throw error

  return data as { total: number; statuses: Record<string, number> }
}
