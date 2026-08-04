import { useLayoutEffect, useRef, useState } from 'react'

/**
 * 测量元素距视口顶部的偏移，返回可填满到视口底部的高度字符串。
 * 用于在 dashboard 外壳（其根为 min-h-svh，无法用 h-full 传递确定高度）内
 * 让页面获得确定高度，从而实现"仅内部区域滚动"。
 * @param bottomGapPx 需要为父级底部 padding 预留的像素（dashboard 内容区 p-4 = 16px）
 */
export function useFillHeight(bottomGapPx = 16) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState('100dvh')

  useLayoutEffect(() => {
    const update = () => {
      const el = ref.current
      if (!el)
        return
      const top = el.getBoundingClientRect().top
      setHeight(`calc(100dvh - ${Math.round(top + bottomGapPx)}px)`)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [bottomGapPx])

  return { ref, height }
}
