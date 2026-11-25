import { getDB } from '@/lib/offline-resume-manager/database'
import { getOfflineResumeProjection } from '@/lib/offline-resume-manager/queries'
import supabase from '@/lib/supabase/client'
import { collectPages } from '@/lib/supabase/pagination'
import { getResumeById } from '@/lib/supabase/resume/get-by-id'

export interface AtsResumeOption {
  resume_id: string
  display_name: string
  updated_at: string
  created_at: string
  isOffline: boolean
}

export type SelectedResumeOption = Pick<
  AtsResumeOption,
  'resume_id' | 'display_name' | 'updated_at'
>

export async function readSelectedResumeOption(id: string, local: boolean) {
  const fields = ['resume_id', 'display_name', 'updated_at'] as const

  if (local)
    return (await getOfflineResumeProjection(
      id,
      fields,
    )) as SelectedResumeOption

  return getResumeById<SelectedResumeOption>(id, fields.join(','))
}

export async function readAtsResumeOptions(owner: string | null) {
  const cloud = owner
    ? collectPages(async (from, to) => {
        const { data, error } = await supabase
          .from('resume_config')
          .select('resume_id,display_name,created_at,updated_at')
          .eq('user_id', owner)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to)

        if (error) throw error

        return data.map((row) => ({ ...row, isOffline: false }))
      }, 500)
    : []

  const [online, offline] = await Promise.all([cloud, readLocalOptions()])

  return [...online, ...offline] as AtsResumeOption[]
}

async function readLocalOptions(): Promise<AtsResumeOption[]> {
  const db = await getDB()
  const tx = db.transaction('resumes')

  const readIndex = async (
    field: 'display_name' | 'created_at' | 'updated_at',
  ) => {
    const values = new Map<string, string>()
    let cursor = await tx.store.index(field).openKeyCursor()

    while (cursor) {
      values.set(cursor.primaryKey, cursor.key)
      cursor = await cursor.continue()
    }

    return values
  }

  const [all, names, created, updated] = await Promise.all([
    tx.store.getAllKeys(),
    readIndex('display_name'),
    readIndex('created_at'),
    readIndex('updated_at'),
  ])

  await tx.done

  // 与简历库一致，缺少更新时间的旧记录按主键倒序补在末尾。
  const ids = [...updated.keys()]
    .reverse()
    .concat(all.reverse().filter((id) => !updated.has(id)))

  return ids.map((id) => ({
    resume_id: id,
    display_name: names.get(id) ?? '',
    created_at: created.get(id) ?? '',
    updated_at: updated.get(id) ?? '',
    isOffline: true,
  }))
}
