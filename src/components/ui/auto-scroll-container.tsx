import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface AutoScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  enabled?: boolean
  dependency?: any // 触发滚动的依赖项
  // 覆盖层渲染器：接收当前是否在底部与滚动到底方法，用于渲染"回到底部"按钮等
  renderOverlay?: (state: { atBottom: boolean, scrollToBottom: () => void }) => React.ReactNode
}

// 判定"是否已接近底部"的阈值：仅用于同步"回到底部"按钮与恢复跟随，不用于判断用户是否脱离
const BOTTOM_THRESHOLD = 30

export function AutoScrollContainer({
  children,
  className,
  enabled = true,
  dependency,
  renderOverlay,
  ...props
}: AutoScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // followRef：是否处于"自动跟随底部"状态。只有用户主动向上滚动才会解除跟随。
  const followRef = useRef(true)
  // programmaticRef：标记正在进行程序化滚动，避免其触发的 scroll 事件被误判为用户操作
  const programmaticRef = useRef(false)
  const [atBottom, setAtBottom] = useState(true)

  const measureAtBottom = useCallback(() => {
    const el = containerRef.current
    if (!el)
      return true
    const { scrollTop, scrollHeight, clientHeight } = el
    return scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD
  }, [])

  const scrollToBottomNow = useCallback((behavior: ScrollBehavior) => {
    const el = containerRef.current
    if (!el)
      return
    programmaticRef.current = true
    el.scrollTo({ top: el.scrollHeight, behavior })
    // 程序化滚动可能异步派发 scroll 事件，下一帧再解除标记
    requestAnimationFrame(() => {
      programmaticRef.current = false
    })
  }, [])

  const scrollToBottom = useCallback(() => {
    followRef.current = true
    setAtBottom(true)
    scrollToBottomNow('smooth')
  }, [scrollToBottomNow])

  // scroll 事件仅用于同步"回到底部"按钮显隐，不改变跟随状态（跟随只由用户 wheel/touch 意图决定）
  const handleScroll = useCallback(() => {
    if (programmaticRef.current)
      return
    // 跟随态下按钮本就不应出现；跳过更新可避免 smooth 滚动动画期间按钮闪回
    if (followRef.current) {
      if (atBottom)
        return
      setAtBottom(true)
      return
    }
    setAtBottom(measureAtBottom())
  }, [atBottom, measureAtBottom])

  // 用户主动上滚（滚轮上滚 / 触摸下拉）→ 解除跟随；滚回底部则恢复
  const handleUserScrollIntent = useCallback((deltaUp: boolean) => {
    const isBottom = measureAtBottom()
    if (deltaUp) {
      followRef.current = false
    }
    else if (isBottom) {
      followRef.current = true
    }
    setAtBottom(isBottom)
  }, [measureAtBottom])

  useEffect(() => {
    const el = containerRef.current
    if (!el)
      return
    const onWheel = (e: WheelEvent) => handleUserScrollIntent(e.deltaY < 0)
    let lastTouchY = 0
    const onTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0]?.clientY ?? 0
    }
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0
      handleUserScrollIntent(y > lastTouchY)
      lastTouchY = y
    }
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [handleUserScrollIntent])

  // enabled 变为 true（新一轮流式开始）时重置为跟随。
  // 必须声明在下方"依赖变化贴底"effect 之前：当 enabled 与 dependency 同帧变化时，
  // React 按声明顺序执行，先重置 followRef 再判断是否贴底，避免新会话首个 token 漏追。
  useEffect(() => {
    if (enabled) {
      followRef.current = true
      setAtBottom(true)
    }
  }, [enabled])

  // 依赖变化（新增消息/流式追加）时，若仍处于跟随态就贴底
  useEffect(() => {
    if (enabled && followRef.current) {
      scrollToBottomNow('auto')
    }
  }, [dependency, enabled, scrollToBottomNow])

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={containerRef}
        className={cn('overflow-auto', className)}
        onScroll={handleScroll}
        {...props}
      >
        {children}
      </div>
      {renderOverlay?.({ atBottom, scrollToBottom })}
    </div>
  )
}
