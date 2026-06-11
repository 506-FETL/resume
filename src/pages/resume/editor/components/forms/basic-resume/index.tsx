import type { RemoteFieldArrayAdapters } from '@/hooks/form-remote-sync'
import type { BasicFormType } from '@/lib/schema'
import type { ShallowPartial } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Form } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { useFormRemoteSync } from '@/hooks/use-form-remote-sync'
import { resumeSchema } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useResumeStore from '@/store/resume/form'
import { ContactFields } from './basic-fields/contact-fields'
import { CustomFields } from './basic-fields/custom-fields'
import { DemographicFields } from './basic-fields/demographic-fields'
import { PersonalFields } from './basic-fields/personal-fields'

function BasicResumeForm({ className }: { className?: string }) {
  const basics = useResumeStore(state => state.basics)
  const updateForm = useResumeStore(state => state.updateForm)

  const form = useForm({
    resolver: zodResolver(resumeSchema.shape.basics),
    defaultValues: basics,
    mode: 'onChange',
    reValidateMode: 'onChange',
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'customFields',
  })
  const remoteFieldArrays = useMemo<RemoteFieldArrayAdapters>(() => ({
    customFields: {
      append: (value, options) => append(value as any, options),
      remove,
    },
  }), [append, remove])
  const isResettingRef = useFormRemoteSync(form, basics, remoteFieldArrays)

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (isResettingRef.current)
        return
      updateForm('basics', value as ShallowPartial<BasicFormType>)
    })
    return () => subscription.unsubscribe()
  }, [form, updateForm, isResettingRef])

  return (
    <Form {...form}>
      <form id="basic-resume-form" className={cn(className)}>
        <motion.div layout className="grid gap-4 justify-items-start sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <PersonalFields form={form} />
          <ContactFields form={form} />
          <DemographicFields form={form} />
        </motion.div>
        <Separator className="mt-6" />
        <CustomFields
          form={form}
          fields={fields}
          append={append}
          remove={remove}
        />
      </form>
    </Form>
  )
}

export default BasicResumeForm
