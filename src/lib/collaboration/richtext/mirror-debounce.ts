/**
 * 去抖镜像工具：把高频调用合并为「静默 `wait` ms 后执行最后一次」。
 *
 * 用于富文本协作的 HTML 镜像写路径：编辑器每次 `onUpdate` 都会产出新 HTML，
 * 直接写 Automerge 会造成高频 op 与频繁的远端 setValue（放大读路径 isResettingRef 窗口）。
 * 去抖后只在停顿时落一次 HTML；`flush` 用于会话/编辑器 teardown 时立即落最后一次，
 * 避免丢失最后 <wait ms 的编辑。
 */
export interface DebouncedMirror<T> {
  run: (arg: T) => void
  flush: () => void
  cancel: () => void
}

export function createDebouncedMirror<T>(fn: (arg: T) => void, wait: number): DebouncedMirror<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let hasPending = false
  let lastArg: T

  function clear() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    hasPending = false
  }

  return {
    run(arg: T) {
      lastArg = arg
      hasPending = true
      if (timer !== null) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        timer = null
        hasPending = false
        fn(lastArg)
      }, wait)
    },
    flush() {
      if (hasPending) {
        const arg = lastArg
        clear()
        fn(arg)
      }
    },
    cancel() {
      clear()
    },
  }
}
