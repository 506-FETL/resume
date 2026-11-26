import { useEffect, useRef, useState } from 'react'
import { templateScrollRoot } from '../utils'

export function useTemplateIntersection(
  rootMargin: string,
  once = false,
  observationKey?: number | null,
) {
  const ref = useRef<HTMLDivElement>(null)
  const [inRange, setInRange] = useState(false)

  useEffect(() => {
    const element = ref.current

    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      // 图片直接加载；列表保留手动按钮，不在降级环境遍历整个目录。
      setInRange(once)

      return
    }

    const grid = once && element.closest('[data-template-gallery-grid]')

    if (grid)
      return observeGalleryCard(grid, element, rootMargin, () =>
        setInRange(true),
      )

    if (!once) setInRange(false)

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInRange((current) =>
          once ? current || entry.isIntersecting : entry.isIntersecting,
        )

        if (once && entry.isIntersecting) observer.unobserve(element)
      },
      { root: templateScrollRoot(element), rootMargin },
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [rootMargin, once, observationKey])

  return { ref, inRange }
}

interface GalleryObserver {
  observer: IntersectionObserver
  callbacks: Map<Element, () => void>
}

const galleries = new WeakMap<Element, GalleryObserver>()

function observeGalleryCard(
  grid: Element,
  element: Element,
  rootMargin: string,
  show: () => void,
) {
  let group = galleries.get(grid)

  if (!group) {
    const callbacks = new Map<Element, () => void>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue

          observer.unobserve(entry.target)
          callbacks.get(entry.target)?.()
          callbacks.delete(entry.target)
        }
      },
      { root: templateScrollRoot(grid as HTMLElement), rootMargin },
    )

    group = { observer, callbacks }
    galleries.set(grid, group)
  }

  const { observer, callbacks } = group

  callbacks.set(element, show)
  observer.observe(element)

  return () => {
    observer.unobserve(element)
    callbacks.delete(element)

    if (!callbacks.size && galleries.get(grid) === group) {
      observer.disconnect()
      galleries.delete(grid)
    }
  }
}
