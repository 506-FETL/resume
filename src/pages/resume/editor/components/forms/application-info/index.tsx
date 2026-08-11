import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useResumeFormSync } from '@/hooks/collab/use-resume-form-sync'
import { resumeSchema } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useResumeStore from '@/store/resume/form'

function ApplicationInfoForm({ className }: { className?: string }) {
  const applicationInfo = useResumeStore(state => state.application_info)

  const form = useForm({
    resolver: zodResolver(resumeSchema.shape.application_info),
    defaultValues: applicationInfo,
    mode: 'onChange',
    reValidateMode: 'onChange',
  })

  // 远程协作字段级双向同步（含同字段并发的光标保持）
  useResumeFormSync(form, 'application_info', applicationInfo)

  return (
    <Form {...form}>
      <form id="application-info-form" className={cn(className)}>
        <motion.div layout className="grid gap-4 justify-items-start @sm/panel:grid-cols-2 @2xl/panel:grid-cols-4">
          <FormField
            control={form.control}
            name="applicationSchool"
            render={({ field }) => (
              <FormItem>
                <FormLabel>报考院校</FormLabel>
                <FormControl>
                  <Input placeholder="例如：清华大学 / 北京大学" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="applicationMajor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>报考专业</FormLabel>
                <FormControl>
                  <Input placeholder="例如：计算机科学与技术 / 软件工程" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </motion.div>
      </form>
    </Form>
  )
}

export default ApplicationInfoForm
