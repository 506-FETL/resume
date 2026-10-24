import { PerfectCursor } from 'perfect-cursors'
import { useCallback, useEffect, useRef } from 'react'

// Keep the library's interpolation window enabled so remote cursors animate between sparse points.
PerfectCursor.MAX_INTERVAL = 40

/**
 * 创建一个基于 `perfect-cursors` 的平滑光标轨迹推送器。
 *
 * Hook 会在内部维护 `PerfectCursor` 实例，并把每一次插值后的坐标点
 * 通过回调 `cb` 输出给调用方，从而让远端或镜像光标的运动看起来更顺滑。
 *
 * 返回的函数用于持续喂入原始坐标点；组件卸载时会自动销毁内部实例。
 *
 * @param cb 每当平滑算法生成新坐标点时触发的回调
 * @returns 一个接收 `[x, y]` 坐标数组的方法，用于向平滑器追加新的光标点
 */
export function usePerfectCursor(cb: (point: number[]) => void) {
  const callbackRef = useRef(cb)

  useEffect(() => {
    callbackRef.current = cb
  }, [cb])

  const cursorRef = useRef<PerfectCursor | null>(null)

  useEffect(() => {
    cursorRef.current = new PerfectCursor((point) => callbackRef.current(point))

    return () => {
      cursorRef.current?.dispose()
      cursorRef.current = null
    }
  }, [])

  return useCallback((point: number[]) => {
    cursorRef.current?.addPoint(point)
  }, [])
}
