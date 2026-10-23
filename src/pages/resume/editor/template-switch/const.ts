import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { create } from 'zustand'
import { resumeTemplateSource } from '@/lib/resume-template/source'
import { CATALOG_TTL_MS } from '@/lib/resume-template/source/remote'
import { createTemplateResourceStore } from '@/store/resume-template'

// 独立维护弹窗的筛选和分页；定义、图片和底层请求仍使用共享缓存。
export const useTemplateSwitchCatalog = createTemplateResourceStore(resumeTemplateSource)

interface CatalogDetail {
  item: TemplateCatalogItem | null
  listed: boolean
  savedAt: number
}
interface CatalogDetails {
  entries: Record<string, CatalogDetail>
  errors: Record<string, string | undefined>
  load: (id: string, force?: boolean) => Promise<void>
}
const pending = new Map<string, Promise<void>>()
export const useTemplateCatalogDetails = create<CatalogDetails>((set, get) => ({
  entries: {},
  errors: {},
  load(id, force = false) {
    const cached = get().entries[id]
    if (!force && cached && Date.now() - cached.savedAt < CATALOG_TTL_MS)
      return Promise.resolve()
    const existing = pending.get(id)
    if (existing)
      return existing
    const promise = resumeTemplateSource.getTemplateCatalogEntry(id, { force }).then((entry) => {
      set((state) => {
        const entries = { ...state.entries, [id]: { item: entry?.item ?? null, listed: entry?.listed ?? false, savedAt: Date.now() } }
        const keys = Object.keys(entries).sort((a, b) => entries[a].savedAt - entries[b].savedAt)
        keys.slice(0, Math.max(0, keys.length - 96)).forEach(key => delete entries[key])
        return { entries, errors: { ...state.errors, [id]: undefined } }
      })
    }, () => {
      set(state => ({ errors: { ...state.errors, [id]: '模板信息暂不可用' } }))
    }).finally(() => pending.delete(id))
    pending.set(id, promise)
    return promise
  },
}))

useTemplateSwitchCatalog.subscribe((state, previous) => {
  if (state.catalog === previous.catalog || state.catalog.status !== 'ready')
    return
  const items = state.catalog.data
  useTemplateCatalogDetails.setState((details) => {
    const entries = { ...details.entries }
    items.forEach(item => entries[item.templateId] = { item, listed: true, savedAt: Date.now() })
    return { entries }
  })
})
