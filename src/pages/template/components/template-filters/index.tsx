import { ChevronDown, Columns2, Palette, SlidersHorizontal } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useResumeTemplateStore } from '@/store/resume-template'
import { useTemplatePageStore } from '../../store.ts'

export default function TemplateFilters() {
  const facets = useResumeTemplateStore(state => state.facets)
  const loadFacets = useResumeTemplateStore(state => state.loadFacets)
  const { styleFilter, layoutFilter, setStyleFilter, setLayoutFilter, resetFilters } = useTemplatePageStore()
  const [open, setOpen] = useState(true)
  const [openGroups, setOpenGroups] = useState({ style: true, layout: true })
  const reduceMotion = useReducedMotion()
  const transitionStyle = { transitionDuration: reduceMotion ? '0s' : `${DURATION.base}s` }
  const collapseStyle = (expanded: boolean) => ({
    animationDuration: reduceMotion ? '0s' : `${expanded ? DURATION.base : DURATION.fast}s`,
    animationTimingFunction: `cubic-bezier(${(expanded ? EASE.out : EASE.in).join(',')})`,
  })
  const groups = [
    { key: 'style' as const, title: '模板风格', all: '全部风格', icon: Palette, value: styleFilter, onChange: setStyleFilter },
    { key: 'layout' as const, title: '排版布局', all: '全部布局', icon: Columns2, value: layoutFilter, onChange: setLayoutFilter },
  ]

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <aside aria-label="筛选模板" className="self-start rounded-xl border bg-muted/20 lg:sticky lg:top-6">
        <div className="flex items-center justify-between gap-1 px-3 py-2.5">
          <h2 className="min-w-0 flex-1">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                aria-label={open ? '收起筛选模板' : '展开筛选模板'}
                className="flex min-h-9 w-full items-center gap-1.5 rounded-md px-1 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                style={transitionStyle}
              >
                <SlidersHorizontal aria-hidden className="size-3.5 shrink-0" />
                <span>筛选模板</span>
                <ChevronDown aria-hidden className={cn('ml-auto size-3.5 shrink-0 transition-transform', !open && '-rotate-90')} style={transitionStyle} />
              </button>
            </CollapsibleTrigger>
          </h2>
          <Button variant="ghost" size="xs" disabled={!styleFilter && !layoutFilter} onClick={resetFilters} className="px-1 text-xs text-muted-foreground motion-reduce:transform-none" style={transitionStyle}>重置</Button>
        </div>
        <CollapsibleContent inert={!open} style={collapseStyle(open)}>
          {facets.status === 'error' && (
            <div role="alert" className="px-3 py-2 text-xs text-destructive">
              筛选选项加载失败
              <Button variant="ghost" size="xs" onClick={() => loadFacets(true)}>重试</Button>
            </div>
          )}
          {(facets.status === 'idle' || facets.status === 'loading') && <p role="status" className="px-3 py-2 text-xs text-muted-foreground">加载筛选选项…</p>}
          <div className="grid grid-cols-2 gap-4 border-t p-3 lg:grid-cols-1 lg:gap-5 lg:py-4">
            {groups.map(({ key, title, all, icon: Icon, value, onChange }) => {
              const expanded = openGroups[key]
              const options = facets.status === 'ready' ? facets.data[key === 'style' ? 'styles' : 'layouts'] : []
              return (
                <Collapsible key={key} open={expanded} onOpenChange={next => setOpenGroups(current => ({ ...current, [key]: next }))} className="min-w-0">
                  <h3>
                    <CollapsibleTrigger asChild>
                      <button
                        id={`template-filter-${key}`}
                        type="button"
                        className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        style={transitionStyle}
                      >
                        <Icon aria-hidden className="size-3.5" />
                        <span>{title}</span>
                        <ChevronDown aria-hidden className={cn('ml-auto size-3.5 transition-transform', !expanded && '-rotate-90')} style={transitionStyle} />
                      </button>
                    </CollapsibleTrigger>
                  </h3>
                  <CollapsibleContent inert={!expanded} style={collapseStyle(expanded)}>
                    <div role="group" aria-labelledby={`template-filter-${key}`} className="flex flex-wrap gap-1 px-1 pt-1 pb-1 lg:flex-col">
                      {[null, ...options].map(option => (
                        <button
                          key={option ?? 'all'}
                          type="button"
                          aria-pressed={value === option}
                          onClick={() => onChange(option)}
                          className={cn('flex min-h-9 items-center rounded-md px-3 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring', value === option ? 'bg-background font-medium text-foreground shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                          style={transitionStyle}
                        >
                          {option ?? all}
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </CollapsibleContent>
      </aside>
    </Collapsible>
  )
}
