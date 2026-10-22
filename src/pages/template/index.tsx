import { ScanSearch } from 'lucide-react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import AnimatedContent from '@/components/motion/animated-content'
import { PresenceDiv } from '@/components/motion/presence-item'
import TemplateResourceStatus from '@/components/resume/template-resource-status'
import { Button } from '@/components/ui/button'
import { DURATION, EASE, staggerDelay } from '@/lib/motion'
import { CATALOG_PAGE_SIZE } from '@/lib/resume-template/source/types'
import { useResumeTemplateStore } from '@/store/resume-template'
import CatalogFooter from './components/catalog-footer'
import PreviewDialog from './components/preview-dialog'
import TemplateCard from './components/template-card'
import TemplateFilters from './components/template-filters'
import { useTemplatePageStore } from './store.ts'

export default function Template() {
  const catalog = useResumeTemplateStore(state => state.catalog)
  const { selectedTemplateId, styleFilter, layoutFilter, resetFilters } = useTemplatePageStore()

  // 预先挂载关闭状态的预览容器，让首次打开也能经过 primitive 的入场状态。
  const previewItem = catalog.status === 'ready'
    ? catalog.data.find(item => item.templateId === selectedTemplateId) ?? catalog.data[0]
    : undefined
  const items = catalog.status === 'ready' ? catalog.data : []

  const { nextOffset, loadFacets } = useResumeTemplateStore(
    useShallow(state => ({
      nextOffset: state.nextOffset,
      loadFacets: state.loadFacets,
    })),
  )

  const load = useResumeTemplateStore(state => state.loadCatalog)
  const reduceMotion = useReducedMotion()
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    load({ style: styleFilter, layout: layoutFilter })
  }, [load, styleFilter, layoutFilter])

  useEffect(() => {
    loadFacets()
  }, [loadFacets])

  useEffect(() => {
    if (params.size) {
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  return (
    <PageLayout width="wide">
      <PageHeader title="简历模板" description="挑选适合的排版" />
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <TemplateFilters />
        <AnimatedContent animationKey={catalog.status}>
          {catalog.status === 'ready'
            ? (
                <div className="min-w-0">
                  <section aria-label="模板列表" className="min-w-0 space-y-4">
                    <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 text-sm font-medium">
                        {styleFilter || layoutFilter ? '筛选结果' : '全部模板'}
                        <span
                          aria-live="polite"
                          className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground"
                        >
                          {nextOffset !== null ? `${items.length}+` : items.length}
                        </span>
                      </h2>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15.5rem),1fr))] gap-5">
                      <AnimatePresence initial={false} mode="popLayout">
                        {items.map((item, index) => (
                          <PresenceDiv
                            key={item.templateId}
                            className="min-w-0"
                            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{
                              opacity: 0,
                              y: reduceMotion ? 0 : -4,
                              transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in },
                            }}
                            transition={{
                              duration: reduceMotion ? 0 : DURATION.base,
                              ease: EASE.out,
                              delay: reduceMotion ? 0 : staggerDelay(Math.min(index % CATALOG_PAGE_SIZE, 8)),
                            }}
                          >
                            <TemplateCard item={item} />
                          </PresenceDiv>
                        ))}
                        {!items.length && (
                          <PresenceDiv
                            key="empty"
                            className="col-span-full flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduceMotion ? 0 : DURATION.base }}
                          >
                            <ScanSearch aria-hidden className="size-7 text-muted-foreground" />
                            <p className="text-sm font-medium">暂无符合条件的模板</p>
                            <Button variant="outline" size="sm" onClick={resetFilters} className="motion-reduce:transform-none" style={{ transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s` }}>清除筛选</Button>
                          </PresenceDiv>
                        )}
                      </AnimatePresence>
                    </div>
                    {items.length > 0 && <CatalogFooter />}
                  </section>
                </div>
              )
            : <TemplateResourceStatus error={catalog.status === 'error' ? catalog.error.message : undefined} onRetry={() => { load({ style: styleFilter, layout: layoutFilter }, true) }} />}
        </AnimatedContent>
      </div>
      {previewItem && <PreviewDialog item={previewItem} />}
    </PageLayout>
  )
}
