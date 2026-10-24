import type { PointerEvent } from 'react'
import type {
  ExampleRef,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'
import { useCallback, useEffect, useRef } from 'react'
import { TEMPLATE_PREFETCH_DELAY_MS } from '../const'
import { prefetchTemplatePreview } from '../utils'

/** 划过卡片不会下载详情；点击仍立即启动必要数据加载。 */
export function useTemplatePrefetch(
  item: TemplateCatalogItem,
  example: ExampleRef,
  disabled = false,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const prefetch = useCallback(() => {
    cancel()

    if (!disabled) prefetchTemplatePreview(item, example)
  }, [cancel, disabled, item, example])

  const schedule = useCallback(() => {
    cancel()

    if (!disabled)
      timer.current = setTimeout(prefetch, TEMPLATE_PREFETCH_DELAY_MS)
  }, [cancel, disabled, prefetch])

  useEffect(() => cancel, [cancel, prefetch])

  return {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen')
        schedule()
    },
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onFocus: schedule,
    onBlur: cancel,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button === 0 && event.pointerType !== 'touch') prefetch()
    },
  }
}
