import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { ResumeFormSync } from '../shared/resume-form-sync'
import { selfEvaluationFormSchema } from '@/lib/schema'
import { cn } from '@/lib/utils'
import { RichTextFieldEditor } from '@/pages/resume/editor/components/forms/shared/rich-text-field-editor'
import useResumeStore from '@/store/resume/form'

function SelfEvaluationForm({ className }: { className?: string }) {
  const [selfEvaluation] = useState(
    () => useResumeStore.getState().self_evaluation,
  )

  const jobIntentText = useResumeStore((state) => state.job_intent.jobIntent)

  const form = useForm({
    resolver: zodResolver(selfEvaluationFormSchema),
    defaultValues: {
      content: selfEvaluation.content || '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  })

  return (
    <Form {...form}>
      <ResumeFormSync form={form} section='self_evaluation' />
      <form id='self-evaluation-form'>
        <div className={cn('space-y-6', className)}>
          <FormField
            name='content'
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>自我评价</FormLabel>
                <FormControl>
                  <RichTextFieldEditor
                    sectionKey='self_evaluation'
                    relativePath='content'
                    value={field.value || ''}
                    onChange={field.onChange}
                    fieldContext={{
                      sectionKey: 'self_evaluation',
                      fieldLabel: '自我评价',
                      jobIntent: jobIntentText,
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  )
}

export default SelfEvaluationForm
