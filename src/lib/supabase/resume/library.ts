import type { ResumeListItem } from '@/lib/schema'
import { readResumeListTemplateBinding } from '@/lib/resume-template/binding'
import supabase from '../client'

export const RESUME_LIBRARY_PAGE_SIZE = 10

export type ResumeLibraryFilter = 'all' | 'roots' | 'variants' | 'pending'

export interface ResumeLibraryCloudCounts {
  all: number
  roots: number
  variants: number
  readyVariants: number
  pending: number
}

const LIST_FIELDS =
  'resume_id,created_at,updated_at,type,display_name,description,parent_resume_id,linked_jd_text,derived_metadata,derived_status,template_binding'

function listQuery(ownerId: string, filter: ResumeLibraryFilter) {
  const query = supabase
    .from('resume_config')
    .select(LIST_FIELDS)
    .eq('user_id', ownerId)

  if (filter === 'roots') return query.is('parent_resume_id', null)
  if (filter === 'variants')
    return query
      .not('parent_resume_id', 'is', null)
      .eq('derived_status', 'ready')
  if (filter === 'pending')
    return query.in('derived_status', ['generating', 'failed'])

  return query
}

export async function getResumeLibraryPage(
  ownerId: string,
  filter: ResumeLibraryFilter,
  offset: number,
  size = RESUME_LIBRARY_PAGE_SIZE,
): Promise<ResumeListItem[]> {
  const limit = Math.min(RESUME_LIBRARY_PAGE_SIZE, Math.max(1, size))

  const { data, error } = await listQuery(ownerId, filter)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('resume_id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return data.map((resume) => ({
    ...resume,
    isOffline: false,
    templateBinding: readResumeListTemplateBinding(resume.template_binding),
  }))
}

export async function getResumeLibraryCounts(
  ownerId: string,
): Promise<ResumeLibraryCloudCounts> {
  const count = () =>
    supabase
      .from('resume_config')
      .select('resume_id', { count: 'exact', head: true })
      .eq('user_id', ownerId)

  const results = await Promise.all([
    count(),
    count().is('parent_resume_id', null),
    count().not('parent_resume_id', 'is', null),
    count().not('parent_resume_id', 'is', null).eq('derived_status', 'ready'),
    count().in('derived_status', ['generating', 'failed']),
  ])

  for (const result of results) {
    if (result.error) throw result.error
    if (result.count === null) throw new Error('未能读取简历数量，请重试')
  }

  return {
    all: results[0].count!,
    roots: results[1].count!,
    variants: results[2].count!,
    readyVariants: results[3].count!,
    pending: results[4].count!,
  }
}

export async function getResumeLibraryParents(
  ownerId: string,
  ids: string[],
): Promise<ResumeListItem[]> {
  const parents: ResumeListItem[] = []

  for (
    let offset = 0;
    offset < ids.length;
    offset += RESUME_LIBRARY_PAGE_SIZE
  ) {
    const { data, error } = await supabase
      .from('resume_config')
      .select('resume_id,display_name,type,created_at,updated_at')
      .eq('user_id', ownerId)
      .in('resume_id', ids.slice(offset, offset + RESUME_LIBRARY_PAGE_SIZE))
      .range(0, RESUME_LIBRARY_PAGE_SIZE - 1)

    if (error) throw error

    parents.push(...data.map((resume) => ({ ...resume, isOffline: false })))
  }

  return parents
}
