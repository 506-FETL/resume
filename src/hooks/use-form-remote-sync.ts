import type { FieldPath, FieldPathValue, FieldValues, UseFormReturn } from 'react-hook-form'
import type { LeafClass } from './collab/classify-leaf'
import type { ActiveTextField } from './collab/focus-registry'
import type { RemoteFieldArrayAdapters } from './form-remote-sync'
import { useEffect, useRef } from 'react'
import { mapCaretByDiff } from './collab/text-caret-diff'
import { applyRemoteFormSyncPlan, planRemoteFormSync } from './form-remote-sync'

/**
 * 同步远程（Automerge）store 变更到 react-hook-form 实例。
 *
 * react-hook-form 的 `defaultValues` 仅在初始化时读取一次，
 * 当远程协作者通过 Automerge 修改数据并更新 Zustand store 后，
 * 本地的 form 实例不会自动感知变化。
 *
 * 该 hook 监听 store 数据变化，通过增量字段更新将远程数据同步到 form，
 * 避免 reset 整个表单导致字段数组重建和当前编辑控件失焦。
 *
 * 返回 `isResettingRef`，调用方应在 `form.watch` 回调中检查该 ref，
 * 以避免远端增量写入 → watch → updateForm 的循环广播。
 *
 * 可选的 `caret` 配置用于**同字段并发**下的光标保持：当远端修改的字段恰是当前
 * 聚焦的自由文本输入框时，在 `setValue` 后按文本 diff 还原光标偏移，避免光标跳到末尾。
 *
 * @param form react-hook-form 实例
 * @param storeData 从 Zustand 或协作 store 中读取到的最新远程表单数据
 * @param fieldArrays 字段数组适配器（不抢焦点的 append/remove）
 * @param caret 可选的光标保持配置
 * @returns 一个 ref 对象；当 `current === true` 时表示本次变更来自远端同步，调用方应跳过向远端回写
 */
export interface CaretPreservationConfig {
  sectionKey: string
  classify: (sectionKey: string, relativePath: string) => LeafClass
  getActiveField: () => ActiveTextField | null
}

export function useFormRemoteSync<T extends FieldValues>(
  form: UseFormReturn<T>,
  storeData: T,
  fieldArrays: RemoteFieldArrayAdapters = {},
  caret?: CaretPreservationConfig,
) {
  const isResettingRef = useRef(false)
  const fieldArraysRef = useRef(fieldArrays)
  fieldArraysRef.current = fieldArrays
  const caretRef = useRef(caret)
  caretRef.current = caret

  useEffect(() => {
    const currentFormValues = form.getValues()
    const adapters = fieldArraysRef.current
    const plan = planRemoteFormSync(
      currentFormValues,
      storeData,
      Object.keys(adapters),
    )

    if (plan.fieldUpdates.length === 0 && plan.fieldArrayOperations.length === 0) {
      isResettingRef.current = false
      return
    }

    // 若被远端修改的字段恰是当前聚焦的自由文本输入框，捕获其旧值与光标，稍后还原。
    const caretRestore = captureCaretRestore(plan, caretRef.current)

    isResettingRef.current = true
    applyRemoteFormSyncPlan(
      plan,
      {
        setValue: (path, value, options) => form.setValue(
          path as FieldPath<T>,
          value as FieldPathValue<T, FieldPath<T>>,
          options,
        ),
      },
      adapters,
    )

    const cleanup = setTimeout(() => {
      isResettingRef.current = false
    }, 0)

    let caretFrame = 0
    if (caretRestore) {
      caretFrame = requestAnimationFrame(() => restoreCaret(caretRestore))
    }

    return () => {
      clearTimeout(cleanup)
      if (caretFrame) {
        cancelAnimationFrame(caretFrame)
      }
      isResettingRef.current = false
    }
  }, [storeData, form])

  return isResettingRef
}

interface CaretRestore {
  el: HTMLInputElement | HTMLTextAreaElement
  oldValue: string
  start: number
  end: number
  newValue: string
}

function captureCaretRestore(
  plan: ReturnType<typeof planRemoteFormSync>,
  caret: CaretPreservationConfig | undefined,
): CaretRestore | null {
  if (!caret) {
    return null
  }

  const active = caret.getActiveField()
  if (!active) {
    return null
  }

  const match = plan.fieldUpdates.find(update => (
    update.path === active.name
    && typeof update.value === 'string'
    && caret.classify(caret.sectionKey, update.path) === 'freeText'
  ))

  if (!match || typeof active.el.value !== 'string') {
    return null
  }

  return {
    el: active.el,
    oldValue: active.el.value,
    start: active.el.selectionStart ?? active.el.value.length,
    end: active.el.selectionEnd ?? active.el.value.length,
    newValue: match.value as string,
  }
}

function restoreCaret({ el, oldValue, start, end, newValue }: CaretRestore) {
  if (!el.isConnected || (typeof document !== 'undefined' && document.activeElement !== el)) {
    return
  }

  const nextStart = mapCaretByDiff(oldValue, newValue, start)
  const nextEnd = mapCaretByDiff(oldValue, newValue, end)

  try {
    el.setSelectionRange(nextStart, nextEnd)
  }
  catch {
    // 某些 input 类型不支持 setSelectionRange；忽略即可。
  }
}
