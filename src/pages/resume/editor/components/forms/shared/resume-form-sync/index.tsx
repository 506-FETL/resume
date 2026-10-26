import type { FieldValues, UseFormReturn } from 'react-hook-form'
import type { RemoteFieldArrayAdapters } from '@/hooks/form-remote-sync'
import type { FormDataMap } from '@/store/resume/const'
import { useResumeFormSync } from '@/hooks/collab/use-resume-form-sync'
import useResumeStore from '@/store/resume/form'

/** 数据同步单独订阅，避免一次字段写入重绘整个 FormProvider 和所有控件。 */
export function ResumeFormSync<T extends FieldValues>({
  form,
  section,
  fieldArrays,
}: {
  form: UseFormReturn<T>
  section: keyof FormDataMap
  fieldArrays?: RemoteFieldArrayAdapters
}) {
  const data = useResumeStore((state) => state[section])

  useResumeFormSync(form, section, data as unknown as T, fieldArrays)

  return null
}
