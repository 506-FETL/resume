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
