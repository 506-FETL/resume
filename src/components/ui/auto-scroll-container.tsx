import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface AutoScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  enabled?: boolean
  dependency?: any // 触发滚动的依赖项
  // 覆盖层渲染器：接收当前是否在底部与滚动到底方法，用于渲染"回到底部"按钮等
  renderOverlay?: (state: { atBottom: boolean, scrollToBottom: () => void }) => React.ReactNode
}

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
  const isAtBottomRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const bottom = scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD
    isAtBottomRef.current = bottom
    setAtBottom(bottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (enabled && isAtBottomRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [dependency, enabled])

  // 当 enabled 变为 true 时（新一轮流式输出开始），重置为跟随底部
  useEffect(() => {
    if (enabled) {
      isAtBottomRef.current = true
      setAtBottom(true)
    }
  }, [enabled])

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
