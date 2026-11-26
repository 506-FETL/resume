import { getDB, type ResumeDB } from '@/lib/offline-resume-manager/database'
import { getOrderedOfflineResumeIds } from '@/lib/offline-resume-manager/library-index'
import type { IDBPObjectStore } from 'idb'
import { ResumeNotFoundError } from '@/lib/resume-id'
import supabase from '@/lib/supabase/client'
import type { AtsResumeLabel } from '@/lib/supabase/resume/ats'
import { readOwnedResumeRow } from '@/lib/supabase/resume/read-owned-row'

export type ResumeSource = 'online' | 'offline'

export interface OptionScore {
  id: number
  overall_score: number | null
}

export interface AtsResumeOption extends AtsResumeLabel {
  created_at: string
  // undefined 表示检测记录未能读取；null 表示确实没有报告。
  report: OptionScore | null | undefined
}

type ResumeStore = IDBPObjectStore<ResumeDB, ['resumes'], 'resumes', 'readonly'>

const PAGE_SIZE = 10
const OPTION_FIELDS = 'resume_id,display_name,created_at,updated_at'

async function readLocalOption(
  store: ResumeStore,
  id: string,
): Promise<AtsResumeOption> {
  const range = IDBKeyRange.bound([id], [id, []])
  const cursor = await store.index('option_metadata').openKeyCursor(range)

  if (cursor) {
    const [resume_id, display_name, created_at, updated_at] = cursor.key

    return { resume_id, display_name, created_at, updated_at, report: null }
  }

  // 缺少日期或名称的旧记录没有复合索引键，只回退当前选项。
  const row = await store.get(id)

  if (!row) throw new ResumeNotFoundError()

  return {
    resume_id: id,
    display_name: row.display_name ?? '',
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
    report: null,
  }
}

export async function readSelectedResumeOption(
  id: string,
  source: ResumeSource,
  owner: string | null,
) {
  if (source === 'offline') {
    const db = await getDB()

    return readLocalOption(db.transaction('resumes').store, id)
  }

  if (!owner) throw new Error('用户未登录')

  return (await readOwnedResumeRow(
    id,
    owner,
    'resume_id,display_name,updated_at',
  )) as unknown as AtsResumeLabel
}

async function readLocalPage(offset: number) {
  const ids = await getOrderedOfflineResumeIds(PAGE_SIZE + 1, offset)
  const db = await getDB()
  const tx = db.transaction('resumes')

  const items = await Promise.all(
    ids.slice(0, PAGE_SIZE).map((id) => readLocalOption(tx.store, id)),
  )

  return { items, hasMore: ids.length > PAGE_SIZE }
}

function cloudPage(owner: string, offset: number, select: string) {
  return supabase
    .from('resume_config')
    .select(select)
    .eq('user_id', owner)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE)
}

type CloudOption = Omit<AtsResumeOption, 'report'> & { reports?: OptionScore[] }

export async function readAtsResumePage(
  source: ResumeSource,
  owner: string | null,
  offset: number,
) {
  if (source === 'offline') return readLocalPage(offset)
  if (!owner) return { items: [], hasMore: false }

  const fields =
    OPTION_FIELDS +
    ',reports:ats!ats_resume_id_fkey(id,overall_score:summary->overall_score)'

  const result = await cloudPage(owner, offset, fields)
    .eq('reports.user_id', owner)
    .order('created_at', { referencedTable: 'reports', ascending: false })
    .order('id', { referencedTable: 'reports', ascending: false })
    .limit(1, { referencedTable: 'reports' })
    .overrideTypes<CloudOption[], { merge: false }>()

  // 检测记录暂不可读时仍允许选择简历；只对本批降级。
  const { data, error } = result.error
    ? await cloudPage(owner, offset, OPTION_FIELDS).overrideTypes<
        CloudOption[],
        { merge: false }
      >()
    : result

  if (error) throw error

  return {
    items: data.slice(0, PAGE_SIZE).map(({ reports, ...resume }) => ({
      ...resume,
      report: reports ? (reports[0] ?? null) : undefined,
    })),
    hasMore: data.length > PAGE_SIZE,
  }
}

export async function readMissingOptionScores(owner: string, ids: string[]) {
  const { data, error } = await supabase
    .from('latest_ats_reports')
    .select('id,resume_id,overall_score')
    .eq('user_id', owner)
    .in('resume_id', ids)
    .overrideTypes<(OptionScore & { resume_id: string })[], { merge: false }>()

  if (error) throw error

  return new Map(data.map((row) => [row.resume_id, row]))
}
