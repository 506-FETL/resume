import * as React from 'react'

/**
 * 根据窗口宽度判断当前是否处于移动端布局。
 *
 * Hook 通过 `matchMedia` 和窗口宽度变化实时更新结果，
 * 当视口宽度小于传入的断点值时返回 `true`。
 *
 * 该判断更偏向布局层面的“窄屏”识别，而不是设备类型识别，
 * 适合响应式组件切换移动端/桌面端交互方式。
 *
 * @param breakpoint 触发移动端判定的宽度断点，默认 `768`
 * @returns 当前视口是否小于断点宽度
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = React.useState(() => (
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  ))

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < breakpoint)
    return () => mql.removeEventListener('change', onChange)
  }, [breakpoint])

  return isMobile
}
