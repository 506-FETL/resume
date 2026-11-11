import type { User } from '@supabase/supabase-js'
import type { ResumeItem } from '@/pages/resume/types'
import type { OfflineResumeLibraryIndex } from '@/lib/offline-resume-manager'
import type {
  ResumeLibraryCloudCounts,
  ResumeLibraryFilter,
} from '@/lib/supabase/resume/library'

export const RESUME_LIBRARY_PAGE_SIZE = 10

export const fixtureUser: User = {
  id: '00000000-0000-4000-8000-000000000101',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'fixture@example.test',
  created_at: '2026-11-01T00:00:00.000Z',
  app_metadata: {},
  user_metadata: { full_name: '示例用户' },
}

export const fixtureAuth = { currentUser: fixtureUser as User | null }

export const params = new URLSearchParams(window.location.search)

export const scenario = params.get('scenario') ?? 'ready'

export const withContext = params.get('context') === '1'

const searchScenario = params.get('search') === '1'

export const fixtureRequests: {
  kind: string
  filter?: string
  offset?: number
  size?: number
  query?: string
  owner?: string
}[] = []

export const fixtureControls = {
  delay: Number(params.get('delay') ?? 800),
  failNextPage: Number(params.get('fail') ?? (scenario === 'error' ? 2 : 0)),
  pause: scenario === 'skeleton' || scenario === 'loading',
  releases: [] as (() => void)[],
}

const items: ResumeItem[] = Array.from(
  { length: scenario === 'empty' ? 0 : Number(params.get('count') ?? 23) },
  (_, index) => ({
    resume_id:
      (withContext && index === 22) ||
      (searchScenario && (index % 5 === 4 || index === 22))
        ? `local-workspace-pagination-${index + 1}`
        : `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    display_name: `示例简历 ${String(index + 1).padStart(2, '0')} · 产品与研发经历`,
    description: searchScenario
      ? index === 11
        ? '观察星云：只在云端描述中命中。'
        : index === 22
          ? '仅描述本地：位于混合列表末页。'
          : index === 17
            ? `字面字符 %_,'"\\ 与 English RUST。`
            : '支持完整搜索的合成摘要。'
      : '这是一条隔离验收使用的合成摘要，用于检查长名称、连续列表与翻页后的滚动位置。',
    type: 'default',
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: new Date(Date.UTC(2026, 10, 11, 12, 0, -index)).toISOString(),
    isOffline:
      (withContext && index === 22) ||
      (searchScenario && (index % 5 === 4 || index === 22)),
    templateBinding: null,
    parent_resume_id:
      (withContext && index === 21) || (searchScenario && index % 4 === 1)
        ? '00000000-0000-4000-8000-000000000001'
        : null,
    derived_status:
      withContext && index === 21
        ? 'failed'
        : searchScenario && index % 4 === 1
          ? 'ready'
          : null,
  }),
)

const cloud = items.filter((item) => !item.isOffline)
const offline = items.filter((item) => item.isOffline)

export async function getCurrentUser() {
  return fixtureAuth.currentUser
}

export async function getOfflineResumeLibraryIndex(
  query = '',
): Promise<OfflineResumeLibraryIndex> {
  record({ kind: 'local-index', query })

  const matching = offline.filter((item) => matches(item, query))

  return {
    all: matching.map((item) => item.resume_id),
    roots: matching
      .filter((item) => !item.parent_resume_id)
      .map((item) => item.resume_id),
    variants: matching
      .filter((item) => item.derived_status === 'ready')
      .map((item) => item.resume_id),
    pending: matching
      .filter((item) => item.derived_status === 'failed')
      .map((item) => item.resume_id),
    variantCount: matching.filter((item) => item.parent_resume_id).length,
  }
}

export async function getOfflineResumeSummariesByIds(ids: string[]) {
  record({ kind: 'local-page', size: ids.length })

  return offline.filter((item) => ids.includes(item.resume_id))
}

export async function getResumeLibraryCounts(
  ownerId: string,
  query = '',
): Promise<ResumeLibraryCloudCounts> {
  record({ kind: 'cloud-counts', query, owner: ownerId })

  const matching = cloud.filter((item) => matches(item, query))

  return {
    all: matching.length,
    roots: matching.filter((item) => !item.parent_resume_id).length,
    variants: matching.filter((item) => item.parent_resume_id).length,
    readyVariants: matching.filter((item) => item.derived_status === 'ready')
      .length,
    pending: matching.filter((item) => item.derived_status === 'failed').length,
  }
}

export async function getResumeLibraryPage(
  ownerId: string,
  filter: ResumeLibraryFilter,
  offset: number,
  size = RESUME_LIBRARY_PAGE_SIZE,
  query = '',
) {
  record({ kind: 'cloud-page', filter, offset, size, query, owner: ownerId })

  if (
    fixtureControls.pause &&
    (scenario === 'skeleton' || offset > 0 || query)
  ) {
    await new Promise<void>((resolve) => fixtureControls.releases.push(resolve))
  } else if (
    offset > 0 ||
    params.get('slowInitial') === '1' ||
    (query && params.get('slowSearch') === '1')
  ) {
    await new Promise((resolve) => setTimeout(resolve, fixtureControls.delay))
  }

  if (
    Math.floor(offset / RESUME_LIBRARY_PAGE_SIZE) + 1 ===
    fixtureControls.failNextPage
  ) {
    fixtureControls.failNextPage = 0

    throw new Error('隔离请求失败，请重试')
  }

  const matching = cloud.filter((item) => {
    if (!matches(item, query)) return false
    if (filter === 'roots') return !item.parent_resume_id
    if (filter === 'variants')
      return Boolean(item.parent_resume_id) && item.derived_status === 'ready'
    if (filter === 'pending') return item.derived_status === 'failed'

    return true
  })

  return matching.slice(offset, offset + size)
}

export async function getResumeLibraryOptionsPage(
  ownerId: string,
  offset: number,
) {
  return getResumeLibraryPage(ownerId, 'all', offset)
}

export async function getResumeLibraryParents(_ownerId: string, ids: string[]) {
  record({ kind: 'parents', size: ids.length })

  return items.filter((item) => ids.includes(item.resume_id))
}

function record(event: (typeof fixtureRequests)[number]) {
  fixtureRequests.push(event)
  document.dispatchEvent(new Event('fixture-metrics'))
}

function matches(item: ResumeItem, query: string) {
  return (
    !query ||
    item.display_name?.toLowerCase().includes(query) ||
    item.description?.toLowerCase().includes(query)
  )
}
