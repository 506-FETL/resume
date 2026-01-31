import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface AutoScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  enabled?: boolean
  dependency?: any // 触发滚动的依赖项
}

export function AutoScrollContainer({
  children,
  className,
  enabled = true,
  dependency,
  ...props
}: AutoScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (enabled && containerRef.current) {
      const element = containerRef.current
      // 检查是否已经在底部附近（允许 50px 的误差），如果是则自动滚动
      // 或者如果是强制自动滚动模式
      element.scrollTop = element.scrollHeight
    }
  }, [dependency, enabled])

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      {...props}
    >
      {children}
    </div>
  )
}
