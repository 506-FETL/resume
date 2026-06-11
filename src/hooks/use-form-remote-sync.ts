import type { FieldPath, FieldPathValue, FieldValues, UseFormReturn } from 'react-hook-form'
import type { RemoteFieldArrayAdapters } from './form-remote-sync'
import { useEffect, useRef } from 'react'
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
 * 该 Hook 只负责“远程数据进入表单”的同步路径，不负责把本地表单修改反推回 store。
 * 因此它通常与 form 的 `watch` / `subscribe` 逻辑配合使用，
 * 一进一出共同完成本地与协作状态的双向同步。
 *
 * @param form react-hook-form 实例
 * @param storeData 从 Zustand 或协作 store 中读取到的最新远程表单数据
 * @returns 一个 ref 对象；当 `current === true` 时表示本次变更来自远端同步，调用方应跳过向远端回写
 */
export function useFormRemoteSync<T extends FieldValues>(
  form: UseFormReturn<T>,
  storeData: T,
  fieldArrays: RemoteFieldArrayAdapters = {},
) {
  const isResettingRef = useRef(false)
  const fieldArraysRef = useRef(fieldArrays)
  fieldArraysRef.current = fieldArrays

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

    return () => {
      clearTimeout(cleanup)
      isResettingRef.current = false
    }
  }, [storeData, form])

  return isResettingRef
}
