import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 创建一个具备防抖能力的稳定回调函数。
 *
 * 在连续触发的场景下，只有停止触发达到 `delay` 毫秒后，
 * 最新一次调用才会真正执行。Hook 内部会始终持有最新的 `callback`，
 * 因此不会因为闭包陈旧而调用到旧逻辑；组件卸载时也会自动清理定时器。
 *
 * 适合输入联想、远程搜索、窗口尺寸响应等不希望高频执行的场景。
 *
 * @param callback 需要延迟执行的原始回调函数
 * @param delay 防抖等待时间，单位为毫秒
 * @returns 一个参数签名与原始回调一致的防抖函数
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  // 保持 callback 引用最新
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay],
  )
}

/**
 * 延迟输出变化后的值。
 *
 * 当 `value` 连续变化时，返回值不会立即更新，
 * 而是等到变化停止达到 `delay` 毫秒后才同步到最新值。
 * 这可以避免基于值变化触发的副作用过于频繁。
 *
 * @param value 需要做防抖处理的任意类型数据
 * @param delay 防抖等待时间，单位为毫秒
 * @returns 延迟后的稳定值
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
