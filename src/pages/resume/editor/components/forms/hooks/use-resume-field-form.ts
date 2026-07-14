import type { FieldArrayPath, FieldValues } from 'react-hook-form'
import type { ZodType } from 'zod'
import type { RemoteFieldArrayAdapters } from '@/hooks/form-remote-sync'
import type { FormDataMap } from '@/store/resume/const'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useResumeFormSync } from '@/hooks/collab/use-resume-form-sync'

interface UseResumeFieldFormOptions<
  TFieldValues extends FieldValues,
  TArrayFieldName extends FieldArrayPath<TFieldValues>,
> {
  fieldName: keyof FormDataMap
  schema: ZodType
  storeFormData: TFieldValues
  arrayFieldName: TArrayFieldName
  defaultItem?: FieldValues[string]
}

export function useResumeFieldForm<
  TFieldValues extends FieldValues,
  TArrayFieldName extends FieldArrayPath<TFieldValues>,
>({
  fieldName,
  schema,
  storeFormData,
  arrayFieldName,
  defaultItem,
}: UseResumeFieldFormOptions<TFieldValues, TArrayFieldName>) {
  const form = useForm<TFieldValues>({
    resolver: zodResolver(schema as any) as any,
    defaultValues: storeFormData as any,
    mode: 'onChange',
    reValidateMode: 'onChange',
  })

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: arrayFieldName,
  })

  const remoteFieldArrays = useMemo<RemoteFieldArrayAdapters>(() => ({
    [arrayFieldName]: {
      append: (value, options) => append(value as any, options),
      remove,
    },
  }), [append, arrayFieldName, remove])

  useResumeFormSync(form, fieldName, storeFormData, remoteFieldArrays)

  function onAddItem() {
    if (defaultItem) {
      append(defaultItem as any)
    }
  }

  return { form, fields, append, remove, move, onAddItem }
}
