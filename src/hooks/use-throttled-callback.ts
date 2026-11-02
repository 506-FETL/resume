import type { DebouncedFunc } from 'lodash'
import throttle from 'lodash/throttle'
import * as React from 'react'

interface ThrottleSettings {
  leading?: boolean | undefined
  trailing?: boolean | undefined
}

const defaultOptions: ThrottleSettings = {
  leading: false,
  trailing: true,
}

/**
 * 创建一个带节流能力的稳定回调函数。
 *
 * Hook 基于 `lodash/throttle` 包装传入回调，并通过 ref 持有最新的 `fn`，
 * 避免节流器内部闭包引用旧函数。只要 `wait` 或依赖项变化，就会重新生成
 * 节流函数；组件卸载时会自动调用 `cancel()` 清理挂起任务。
 *
 * 适合鼠标移动、滚动、窗口尺寸变化、实时同步广播等高频事件场景。
 *
 * @param fn 需要做节流处理的原始回调函数
 * @param wait 两次实际执行之间的最小间隔，单位毫秒
 * @param dependencies 用于控制节流器重建时机的依赖数组
 * @param options 节流配置，决定是否在触发开始和结束时执行
 * @returns 一个具备 `cancel` 与 `flush` 方法的节流回调函数
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  fn: T,
  wait = 250,
  dependencies: React.DependencyList = [],
  options: ThrottleSettings = defaultOptions,
): DebouncedFunc<T> {
  const fnRef = React.useRef(fn)
  const { leading = false, trailing = true } = options

  React.useEffect(() => {
    fnRef.current = fn
  }, [fn])

  const throttledCallback = React.useMemo(
    () =>
      throttle<T>(((...args: any[]) => fnRef.current(...args)) as T, wait, {
        leading,
        trailing,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wait, leading, trailing, ...dependencies],
  )

  React.useEffect(
    () => () => {
      throttledCallback.cancel()
    },
    [throttledCallback],
  )

  return throttledCallback
}

export default useThrottledCallback
