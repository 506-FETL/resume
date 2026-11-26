import { createStore } from 'zustand/vanilla'
import type { ResumeHistoryShareOption } from '@/lib/supabase/resume/history/queries/resumes'
import type { ShareResumeOption } from '@/lib/supabase/resume/share/option-pages'

interface OptionPage<T> {
  items: T[] | null
  error: boolean
}

export function createOptionPages<T>() {
  const store = createStore(() => new Map<string, OptionPage<T>>())

  async function load(key: string, read: () => Promise<T[]>, retry = false) {
    const previous = store.getState().get(key)

    if (previous && !(retry && previous.error)) return

    const pending: OptionPage<T> = { items: null, error: false }
    const pages = new Map(store.getState())

    if (pages.size >= 32) pages.delete(pages.keys().next().value!)

    store.setState(pages.set(key, pending), true)

    let page: OptionPage<T>

    try {
      page = { items: await read(), error: false }
    } catch {
      page = { items: null, error: true }
    }

    if (store.getState().get(key) === pending)
      store.setState(new Map(store.getState()).set(key, page), true)
  }

  return { store, load }
}

export const resumeOptionPages = createOptionPages<ShareResumeOption>()

export const versionOptionPages = createOptionPages<ResumeHistoryShareOption>()

export function invalidateShareVersionPages(resumeId: string) {
  const pages = new Map(versionOptionPages.store.getState())

  for (const key of pages.keys()) {
    if (JSON.parse(key)[1] === resumeId) pages.delete(key)
  }

  versionOptionPages.store.setState(pages, true)
}

export function clearShareOptionPages() {
  resumeOptionPages.store.setState(new Map(), true)
  versionOptionPages.store.setState(new Map(), true)
}
