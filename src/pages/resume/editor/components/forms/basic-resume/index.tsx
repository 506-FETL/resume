import type { RemoteFieldArrayAdapters } from '@/hooks/form-remote-sync'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Form } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { ResumeFormSync } from '../shared/resume-form-sync'
import { SPRING } from '@/lib/motion'
import { resumeSchema } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useResumeStore from '@/store/resume/form'
import { ContactFields } from './basic-fields/contact-fields'
import { CustomFields } from './basic-fields/custom-fields'
import { DemographicFields } from './basic-fields/demographic-fields'
import { PersonalFields } from './basic-fields/personal-fields'
import { ResumePhotoField } from './components/resume-photo'

function BasicResumeForm({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  const [basics] = useState(() => useResumeStore.getState().basics)

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

  const remoteFieldArrays = useMemo<RemoteFieldArrayAdapters>(
    () => ({
      customFields: {
        append: (value, options) => append(value as any, options),
        remove,
      },
    }),
    [append, remove],
  )

  return (
    <Form {...form}>
      <ResumeFormSync
        form={form}
        section='basics'
        fieldArrays={remoteFieldArrays}
      />
      <form id='basic-resume-form' className={cn(className)}>
        <ResumePhotoField form={form} />
        <motion.div
          layout={!reduceMotion}
          transition={reduceMotion ? { duration: 0 } : SPRING.layout}
          className='grid grid-cols-1 items-start gap-4 @lg/panel:grid-cols-2 @3xl/panel:grid-cols-3 @5xl/panel:grid-cols-4 [&>[data-slot=form-item]]:min-w-0'
        >
          <PersonalFields form={form} />
          <ContactFields form={form} />
          <DemographicFields form={form} />
        </motion.div>
        <Separator className='mt-6' />
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
