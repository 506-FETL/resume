'use client'

import * as React from 'react'

// basically Exclude<React.ClassAttributes<T>["ref"], string>
type UserRef<T> =
  | ((instance: T | null) => void)
  | React.RefObject<T | null>
  | null
  | undefined

/**
 * 将同一个 DOM 实例同步写入不同形式的 ref。
 *
 * 该工具函数同时兼容回调 ref 与对象 ref，
 * 用于把内部组件持有的 ref 和外部用户传入的 ref 合并到同一份实例上。
 *
 * @param ref 需要被赋值的 ref，可以是回调 ref 或 `RefObject`
 * @param value 当前需要写入 ref 的实例；卸载或重置时通常为 `null`
 */
function updateRef<T>(ref: NonNullable<UserRef<T>>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref && typeof ref === 'object' && 'current' in ref) {
    // Safe assignment without MutableRefObject
    ref.current = value
  }
}

/**
 * 合并组件库内部 ref 与外部调用方传入的 ref。
 *
 * 返回的回调 ref 会在节点挂载、切换和卸载时同时更新两侧引用，
 * 并在用户 ref 发生变化时主动清理旧 ref，避免旧引用残留。
 *
 * 常用于需要既暴露 DOM 节点给调用方，又要在内部访问同一节点的组件。
 *
 * @param libRef 组件内部使用的 ref 对象
 * @param userRef 外部调用方传入的 ref，支持回调 ref、对象 ref 或空值
 * @returns 一个可直接绑定到 JSX `ref` 属性上的合并回调函数
 */
export function useComposedRef<T extends HTMLElement>(
  libRef: React.RefObject<T | null>,
  userRef: UserRef<T>,
) {
  const prevUserRef = React.useRef<UserRef<T>>(null)

  return React.useCallback(
    (instance: T | null) => {
      if (libRef && 'current' in libRef) {
        libRef.current = instance
      }

      if (prevUserRef.current) {
        updateRef(prevUserRef.current, null)
      }

      prevUserRef.current = userRef

      if (userRef) {
        updateRef(userRef, instance)
      }
    },
    [libRef, userRef],
  )
}

export default useComposedRef
