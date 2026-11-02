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

type ResumeLibraryRow = Omit<
  ResumeListItem,
  'templateBinding' | 'isOffline' | 'derived_metadata'
> & { template_binding: unknown }

const LIST_FIELDS =
  'resume_id,created_at,updated_at,type,display_name,description,parent_resume_id,linked_jd_text,derived_match_rate:derived_metadata->matchRate,derived_status,template_binding'

function listQuery(ownerId: string, filter: ResumeLibraryFilter) {
  const query = supabase
    .from('resume_config')
    .select(
      filter === 'pending'
        ? LIST_FIELDS
        : LIST_FIELDS.replace(
            'linked_jd_text,',
            'linked_jd_excerpt:resume_jd_excerpt,',
          ),
    )
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
    .returns<ResumeLibraryRow[]>()

  if (error) throw error

  return data.map((resume) => ({
    ...resume,
    isOffline: false,
    derived_match_rate:
      typeof resume.derived_match_rate === 'number'
        ? resume.derived_match_rate
        : null,
    templateBinding: readResumeListTemplateBinding(resume.template_binding),
  }))
}

export async function getResumeLibraryOptionsPage(
  ownerId: string,
  offset: number,
): Promise<ResumeListItem[]> {
  const { data, error } = await supabase
    .from('resume_config')
    .select('resume_id,display_name,type,created_at,updated_at,derived_status')
    .eq('user_id', ownerId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('resume_id', { ascending: false })
    .range(offset, offset + RESUME_LIBRARY_PAGE_SIZE - 1)

  if (error) throw error

  return data.map((resume) => ({ ...resume, isOffline: false }))
}

export async function getResumeLibraryCounts(
  ownerId: string,
): Promise<ResumeLibraryCloudCounts> {
  const { data, error } = await supabase.rpc('get_resume_library_counts', {
    p_owner_id: ownerId,
  })

  if (error) throw error

  return readResumeLibraryCounts(data)
}

function readResumeLibraryCounts(value: unknown): ResumeLibraryCloudCounts {
  const fields = [
    'all',
    'roots',
    'variants',
    'readyVariants',
    'pending',
  ] as const

  if (
    !value ||
    typeof value !== 'object' ||
    fields.some((field) => {
      const count = (value as Record<string, unknown>)[field]

      return (
        typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0
      )
    })
  ) {
    throw new Error('未能读取简历数量，请重试')
  }

  return value as ResumeLibraryCloudCounts
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
