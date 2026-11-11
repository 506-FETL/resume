import assert from 'node:assert/strict'
import { createStore } from 'zustand/vanilla'
import { loadSource } from './load-source.mjs'

export function records(count, { mixed = false, variantsOnly = false } = {}) {
  return Array.from({ length: count }, (_, index) => {
    const variant = variantsOnly || (mixed && index % 3 === 1)
    const failed = mixed && index % 5 === 4
    const offline = mixed && index % 4 === 2

    return {
      resume_id: `${offline ? 'local-' : ''}record-${String(index).padStart(3, '0')}`,
      display_name: `合成摘要 ${index}`,
      description: `描述 ${index}`,
      created_at: '2026-11-01T00:00:00.000Z',
      updated_at: new Date(Date.UTC(2026, 10, 11, 12, 0, -index)).toISOString(),
      type: 'default',
      isOffline: offline,
      parent_resume_id: variant || failed ? 'external-parent' : null,
      derived_status: failed ? 'failed' : variant ? 'ready' : null,
    }
  })
}

export async function fixture(initialItems) {
  const data = {
    items: initialItems,
    owner: 'A',
    failCounts: false,
    failPage: false,
    failParents: false,
    pausedFilter: null,
    pausedQuery: null,
    release: null,
  }

  const calls = []
  const events = []

  const select = (items, filter) =>
    items.filter((item) => {
      if (filter === 'roots') return !item.parent_resume_id
      if (filter === 'variants')
        return item.parent_resume_id && item.derived_status === 'ready'
      if (filter === 'pending')
        return ['generating', 'failed'].includes(item.derived_status)

      return true
    })

  const boundary = {
    RESUME_LIBRARY_PAGE_SIZE: 10,
    getCurrentUser: async () => (data.owner ? { id: data.owner } : null),
    getOfflineResumeLibraryIndex: async (query = '') => {
      calls.push({ kind: 'index', owner: data.owner, query })

      const items = data.items.filter(
        (item) => item.isOffline && matches(item, query),
      )

      return {
        all: items.map((item) => item.resume_id),
        roots: select(items, 'roots').map((item) => item.resume_id),
        variants: select(items, 'variants').map((item) => item.resume_id),
        pending: select(items, 'pending').map((item) => item.resume_id),
        variantCount: items.filter((item) => item.parent_resume_id).length,
      }
    },
    getOfflineResumeSummariesByIds: async (ids) => {
      calls.push({ kind: 'local', size: ids.length, owner: data.owner })
      assert.ok(ids.length <= 10)

      return data.items.filter((item) => ids.includes(item.resume_id))
    },
    getResumeLibraryCounts: async (owner, query = '') => {
      calls.push({ kind: 'counts', owner, query })

      if (data.failCounts) {
        data.failCounts = false

        throw new Error('counts failed')
      }

      const items = data.items.filter(
        (item) => !item.isOffline && matches(item, query),
      )

      return {
        all: items.length,
        roots: select(items, 'roots').length,
        variants: items.filter((item) => item.parent_resume_id).length,
        readyVariants: select(items, 'variants').length,
        pending: select(items, 'pending').length,
      }
    },
    getResumeLibraryPage: async (
      owner,
      filter,
      offset,
      size = 10,
      query = '',
    ) => {
      calls.push({ kind: 'page', owner, filter, offset, size, query })
      assert.ok(size <= 10)

      const matching = select(
        data.items.filter((item) => !item.isOffline && matches(item, query)),
        filter,
      )

      const response = matching.slice(offset, offset + size)

      if (data.pausedFilter === filter || data.pausedQuery === query) {
        await new Promise((resolve) => {
          data.release = resolve
        })
      }

      if (data.failPage) {
        data.failPage = false

        throw new Error('page failed')
      }

      return response
    },
    getResumeLibraryOptionsPage: async () => [],
    getResumeLibraryParents: async (owner, ids) => {
      calls.push({ kind: 'parents', owner, ids })

      if (data.failParents) {
        data.failParents = false

        throw new Error('parents failed')
      }

      return ids.map((id) => ({ ...records(1)[0], resume_id: id }))
    },
  }

  const library = await loadSource('src/pages/resume/store/library.ts', {
    '@/lib/supabase/resume/library': boundary,
    '@/lib/offline-resume-manager': boundary,
    '@/lib/supabase/user': boundary,
  })

  const store = createStore((set, get) => ({
    ...library.createResumeLibrarySlice(set, get),
    libraryAccountId: data.owner,
    filterMode: 'all',
    isOnline: true,
  }))

  store.subscribe((state) =>
    events.push({
      loading: state.libraryLoading,
      filter: state.filterMode,
      query: state.libraryQuery,
    }),
  )

  async function settled() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (!store.getState().libraryLoading) return

      await new Promise((resolve) => setImmediate(resolve))
    }

    throw new Error('Store did not settle')
  }

  async function filter(value) {
    store.getState().setLibraryFilter(value)
    await settled()
  }

  function resetObservations() {
    calls.splice(0)
    events.splice(0)
  }

  return {
    data,
    store,
    calls,
    events,
    filter,
    settled,
    resetObservations,
    search: (value) => store.getState().setLibraryQuery(value),
  }
}

function matches(item, query) {
  return (
    item.display_name.toLowerCase().includes(query) ||
    item.description?.toLowerCase().includes(query)
  )
}
