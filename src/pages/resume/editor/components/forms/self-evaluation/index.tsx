import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { useResumeFormSync } from '@/hooks/collab/use-resume-form-sync'
import { selfEvaluationFormSchema } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useResumeStore from '@/store/resume/form'

function SelfEvaluationForm({ className }: { className?: string }) {
  const selfEvaluation = useResumeStore(state => state.self_evaluation)
  const jobIntentText = useResumeStore(state => state.job_intent.jobIntent)

  const form = useForm({
    resolver: zodResolver(selfEvaluationFormSchema),
    defaultValues: {
      content: selfEvaluation.content || '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  })

  // 远程协作字段级双向同步（富文本 content 走整段 LWW）
  const storeFormData = useMemo(() => ({
    content: selfEvaluation.content || '',
  }), [selfEvaluation.content])
  useResumeFormSync(form, 'self_evaluation', storeFormData)

  return (
    <Form {...form}>
      <form id="self-evaluation-form">
        <div className={cn('space-y-6', className)}>
          <FormField
            name="content"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>自我评价</FormLabel>
                <FormControl>
                  <SimpleEditor
                    content={field.value || ''}
                    onChange={(editor) => {
                      field.onChange(editor.getHTML())
                    }}
                    fieldContext={{ sectionKey: 'self_evaluation', fieldLabel: '自我评价', jobIntent: jobIntentText }}
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
