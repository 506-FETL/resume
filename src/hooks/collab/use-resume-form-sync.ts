import type { FieldValues, UseFormReturn } from 'react-hook-form'
import type { RemoteFieldArrayAdapters } from '../form-remote-sync'
import type { CaretPreservationConfig } from '../use-form-remote-sync'
import type { FormDataMap } from '@/store/resume/const'
import { useEffect } from 'react'
import useResumeStore from '@/store/resume/form'
import { planRemoteFormSync } from '../form-remote-sync'
import { useFormRemoteSync } from '../use-form-remote-sync'
import { classifyLeaf } from './classify-leaf'
import { getActiveTextField } from './focus-registry'
import { buildWriteOps } from './write-plan'

/**
 * 简历表单与协作 store 的双向字段级同步。
 *
 * 读路径：复用 `useFormRemoteSync` 增量同步远端变更到 RHF，并对同字段并发保持光标。
 * 写路径：本地表单变化时，以「变更前的 store 值」为 base 计算最小 diff，
 * 翻译成字段级写操作后交给 `updateFormFields`，只写实际变化的叶子，
 * 从而避免整段 section 覆盖导致的跨字段抢占与输入吞没。
 *
 * @param form RHF 实例
 * @param sectionKey 该表单对应的 store section（`basics` / `work_experience` 等）
 * @param storeData 该 section 的最新远端数据（来自 store）
 * @param fieldArrays 字段数组适配器（不抢焦点的 append/remove）
 */
export function useResumeFormSync<T extends FieldValues>(
  form: UseFormReturn<T>,
  sectionKey: keyof FormDataMap,
  storeData: T,
  fieldArrays: RemoteFieldArrayAdapters = {},
) {
  const caret: CaretPreservationConfig = {
    sectionKey: sectionKey as string,
    classify: classifyLeaf,
    getActiveField: getActiveTextField,
  }

  const isResettingRef = useFormRemoteSync(form, storeData, fieldArrays, caret)

  useEffect(() => {
    return form.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        if (isResettingRef.current) {
          return
        }

        // 以「变更前的 store 值」为 base 计算最小 diff（实时读取，避免陈旧闭包）。
        const base = useResumeStore.getState()[sectionKey] as unknown
        const plan = planRemoteFormSync(base, values, Object.keys(fieldArrays))

        if (plan.fieldUpdates.length === 0 && plan.fieldArrayOperations.length === 0) {
          return
        }

        const ops = buildWriteOps(plan, sectionKey as string, classifyLeaf)
        useResumeStore.getState().updateFormFields(
          sectionKey,
          values as unknown as FormDataMap[typeof sectionKey],
          ops,
        )
      },
    })
    // fieldArrays 每次渲染重建，用其 key 集合作为稳定依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, sectionKey, isResettingRef, Object.keys(fieldArrays).join(',')])

  return isResettingRef
}
