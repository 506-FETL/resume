import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import type { ResumeTemplateBinding } from '@/lib/schema'
import { Check, FileText, LoaderCircle, RefreshCw } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect } from 'react'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DURATION, EASE, staggerDelay } from '@/lib/motion'
import { toTemplateBinding } from '@/lib/resume-template/binding'
import { templateKey } from '@/lib/resume-template/source/types'
import { cn } from '@/lib/utils'
import { useTemplateIntersection } from '@/pages/template/hooks/use-template-intersection'
import { useTemplatePreview } from '@/pages/template/hooks/use-template-preview'
import { useResumeTemplateStore } from '@/store/resume-template'
import useResumeStore from '@/store/resume/form'
import { useTemplateCatalogEntry } from '../../hooks/use-template-catalog-entry'
import { useTemplateSwitchCatalog } from '../../template-switch/const'
import { useTemplateSwitchStore } from '../../template-switch/store'
import {
  sameTemplateBinding,
  templateHasPhoto,
} from '../../template-switch/utils'

function TemplateCard({
  binding,
  item,
  index,
  disabled,
}: {
  binding: ResumeTemplateBinding
  item?: TemplateCatalogItem | null
  index: number
  disabled: boolean
}) {
  const reduceMotion = useReducedMotion()
  const currentBinding = useResumeStore((state) => state.templateBinding)
  const photo = useResumeStore((state) => state.basics.photo)
  const selected = useTemplateSwitchStore((state) => state.selectedBinding)
  const select = useTemplateSwitchStore((state) => state.selectTemplate)

  const definition = useResumeTemplateStore(
    (state) => state.definitions[templateKey(binding)],
  )

  const current = sameTemplateBinding(binding, currentBinding)
  const active = sameTemplateBinding(binding, selected)
  const { ref, inRange } = useTemplateIntersection('160px', true)

  const preview = item?.previews.find(
    (preview) =>
      preview.templateVersion === binding.templateVersion &&
      preview.example.exampleId === item.defaultExample.exampleId &&
      preview.example.version === item.defaultExample.version,
  )

  const { url, status, retry } = useTemplatePreview(preview, inRange)
  const name = item?.name ?? '当前模板'

  const noPhoto =
    !!photo &&
    definition?.status === 'ready' &&
    !templateHasPhoto(definition.data)

  const newer =
    currentBinding?.templateId === binding.templateId &&
    binding.templateVersion > currentBinding.templateVersion

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
        delay: reduceMotion ? 0 : staggerDelay(index % 12, 0.02),
      }}
      className='min-w-0'
    >
      <button
        type='button'
        aria-label={`预览${name}${newer ? '新版' : ''}`}
        aria-pressed={active}
        disabled={disabled}
        onClick={() => select(binding)}
        className={cn(
          'group relative w-full overflow-hidden rounded-lg border bg-background text-left outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait',
          active
            ? 'border-foreground ring-1 ring-foreground'
            : 'hover:border-foreground/40',
        )}
      >
        <div className='relative aspect-[210/297] overflow-hidden bg-muted/30'>
          {url ? (
            <img
              src={url}
              alt={`${name}示例缩略图`}
              width={preview?.asset.width}
              height={preview?.asset.height}
              className='h-full w-full object-cover object-top'
            />
          ) : (
            <div className='flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-xs text-muted-foreground'>
              {status === 'loading' ? (
                <LoaderCircle
                  className={cn('size-5', !reduceMotion && 'animate-spin')}
                />
              ) : (
                <FileText className='size-6' />
              )}
              <span>
                {status === 'loading' ? '加载缩略图…' : '查看真实内容预览'}
              </span>
            </div>
          )}
          <div className='absolute left-2 right-2 top-2 flex flex-wrap gap-1 text-[10px] leading-5'>
            {current && (
              <span className='rounded bg-background/95 px-1.5 text-foreground shadow-sm'>
                当前使用
              </span>
            )}
            {newer && (
              <span className='rounded bg-background/95 px-1.5 text-foreground shadow-sm'>
                新版
              </span>
            )}
            {active && (
              <span className='ml-auto inline-flex items-center gap-0.5 rounded bg-foreground px-1.5 text-background'>
                <Check className='size-3' />
                预览中
              </span>
            )}
          </div>
        </div>
        <div className='border-t px-2.5 py-2'>
          <p className='truncate text-xs font-medium' title={name}>
            {name}
          </p>
          <p className='mt-0.5 text-[10px] text-muted-foreground'>
            {item
              ? `${item.category.style} · ${item.category.layout}`
              : '当前精确版本'}
            {current && item && item.currentVersion !== binding.templateVersion
              ? ` · v${binding.templateVersion}`
              : ''}
          </p>
          {noPhoto && (
            <p className='mt-1 text-[10px] leading-relaxed text-muted-foreground'>
              此模板不展示照片，照片仍会保留
            </p>
          )}
        </div>
      </button>
      {status === 'error' && (
        <button
          type='button'
          className='mt-1 text-xs text-muted-foreground underline'
          onClick={retry}
        >
          重试缩略图
        </button>
      )}
    </motion.div>
  )
}

export default function TemplateSwitchGallery() {
  const state = useTemplateSwitchCatalog()
  const currentBinding = useResumeStore((state) => state.templateBinding)
  const current = useTemplateCatalogEntry(currentBinding?.templateId)
  const reduceMotion = useReducedMotion()
  const { loadMore, loadMoreError, nextOffset } = state
  const { ref, inRange } = useTemplateIntersection('160px', false, nextOffset)

  useEffect(() => {
    const catalog = useTemplateSwitchCatalog.getState()

    catalog.loadCatalog(catalog.catalogQuery)
    catalog.loadFacets()
    // 打开弹窗时恢复原有筛选，加载函数自身负责缓存和请求去重。
  }, [])

  useEffect(() => {
    if (inRange && !loadMoreError) loadMore()
  }, [inRange, nextOffset, loadMoreError, loadMore])

  const query = state.catalogQuery
  const items = state.catalog.status === 'ready' ? state.catalog.data : []

  const facets =
    state.facets.status === 'ready'
      ? state.facets.data
      : { styles: ['简约', '创意'], layouts: ['单栏', '双栏'] }

  const currentMatches =
    (!query.style && !query.layout) ||
    (!!current.item &&
      (!query.style || current.item.category.style === query.style) &&
      (!query.layout || current.item.category.layout === query.layout))

  const entries = items.map((item) => ({
    item,
    binding: toTemplateBinding({
      templateId: item.templateId,
      templateVersion: item.currentVersion,
    }),
  }))

  if (currentBinding && currentMatches) {
    const duplicate = entries.findIndex((entry) =>
      sameTemplateBinding(entry.binding, currentBinding),
    )

    if (duplicate !== -1) entries.splice(duplicate, 1)
  }

  return (
    <div
      className='flex min-h-0 flex-1 flex-col'
      data-testid='template-switch-gallery'
    >
      <div className='grid shrink-0 grid-cols-2 gap-2 border-b p-4'>
        <Select
          value={query.style || 'all'}
          onValueChange={(value) =>
            state.loadCatalog({
              ...query,
              style: value === 'all' ? null : value,
            })
          }
        >
          <SelectTrigger className='w-full' aria-label='模板风格'>
            <SelectValue placeholder='全部风格' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>全部风格</SelectItem>
            {facets.styles.map((style) => (
              <SelectItem key={style} value={style}>
                {style}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={query.layout || 'all'}
          onValueChange={(value) =>
            state.loadCatalog({
              ...query,
              layout: value === 'all' ? null : value,
            })
          }
        >
          <SelectTrigger className='w-full' aria-label='模板排版'>
            <SelectValue placeholder='全部排版' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>全部排版</SelectItem>
            {facets.layouts.map((layout) => (
              <SelectItem key={layout} value={layout}>
                {layout}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div
        className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-4'
        data-testid='template-switch-list'
      >
        <p className='mb-3 text-xs text-muted-foreground'>
          缩略图为模板示例，大图预览使用你的真实内容。
        </p>
        {state.refreshingCatalog && (
          <p role='status' className='mb-3 text-xs text-muted-foreground'>
            正在获取模板列表…
          </p>
        )}
        {(state.catalog.status === 'error' || state.catalogRefreshError) && (
          <div role='alert' className='mb-3 text-sm'>
            <p>模板列表加载失败，可重试；当前简历不受影响。</p>
            <Button
              variant='outline'
              size='sm'
              className='mt-2'
              onClick={() => state.loadCatalog(query, true)}
            >
              <RefreshCw className='size-3' />
              重试列表
            </Button>
          </div>
        )}
        <AnimatedContent
          animationKey={JSON.stringify([query.style, query.layout])}
        >
          <div className='grid grid-cols-2 gap-3'>
            {currentBinding && currentMatches && (
              <TemplateCard
                key={templateKey(currentBinding)}
                binding={currentBinding}
                item={current.item}
                index={0}
                disabled={false}
              />
            )}
            {entries.map(({ binding, item }, index) => (
              <TemplateCard
                key={templateKey(binding)}
                binding={binding}
                item={item}
                index={index + 1}
                disabled={
                  state.refreshingCatalog || !!state.catalogRefreshError
                }
              />
            ))}
          </div>
        </AnimatedContent>
        {!entries.length &&
          !currentMatches &&
          state.catalog.status === 'ready' &&
          !state.refreshingCatalog && (
            <p className='py-10 text-center text-sm text-muted-foreground'>
              没有符合条件的模板
            </p>
          )}
        <div ref={ref} className='flex justify-center pt-4'>
          {state.nextOffset !== null && (
            <Button
              variant='ghost'
              size='sm'
              disabled={state.loadingMore || state.refreshingCatalog}
              onClick={() => state.loadMore()}
            >
              {state.loadingMore && (
                <LoaderCircle
                  className={cn('size-4', !reduceMotion && 'animate-spin')}
                />
              )}
              {state.loadMoreError
                ? '加载失败，点击重试'
                : state.loadingMore
                  ? '加载更多模板…'
                  : '加载更多模板'}
            </Button>
          )}
          {state.nextOffset === null &&
            !state.refreshingCatalog &&
            state.catalog.status === 'ready' && (
              <p className='text-xs text-muted-foreground'>
                已展示全部匹配模板
              </p>
            )}
        </div>
      </div>
    </div>
  )
}
