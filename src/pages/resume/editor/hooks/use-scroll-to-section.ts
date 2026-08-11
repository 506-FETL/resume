import type { RefObject } from 'react'
import type { ORDERType } from '@/lib/schema'
import { useCallback } from 'react'

/**
 * 返回一个「把渲染区滚动到指定简历章节」的函数。
 * 渲染内容被 transform: scale() 缩放，故用相对 getBoundingClientRect 差值换算 scrollTop，
 * 不能用 scrollIntoView（会被缩放干扰）。多页克隆下只定位首页内容容器内的第一个匹配 section。
 */
export function useScrollToSection(scrollContainerRef: RefObject<HTMLElement | null>) {
  return useCallback((sectionKey: ORDERType) => {
    const container = scrollContainerRef.current
    if (!container)
      return

    // 多页克隆：优先在首页内容容器内查找，避免命中后续页的重复锚点
    const scope = container.querySelector('[data-resume-content]') ?? container
    const target = scope.querySelector(`[data-section="${sectionKey}"]`) as HTMLElement | null

    // basics 或找不到锚点 → 滚到顶部
    if (!target || sectionKey === 'basics') {
      container.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - 16 // 顶部留 16px 余量
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
  }, [scrollContainerRef])
}
