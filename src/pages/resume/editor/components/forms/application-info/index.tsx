import { zodResolver } from '@hookform/resolvers/zod'
import { motion, useReducedMotion } from 'motion/react'
import { useForm } from 'react-hook-form'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useResumeFormSync } from '@/hooks/collab/use-resume-form-sync'
import { SPRING } from '@/lib/motion'
import { resumeSchema } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useResumeStore from '@/store/resume/form'

function ApplicationInfoForm({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  const applicationInfo = useResumeStore((state) => state.application_info)

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
      <form id='application-info-form' className={cn(className)}>
        <motion.div
          layout={!reduceMotion}
          transition={reduceMotion ? { duration: 0 } : SPRING.layout}
          className='grid grid-cols-1 items-start gap-4 @lg/panel:grid-cols-2 [&>[data-slot=form-item]]:min-w-0'
        >
          <FormField
            control={form.control}
            name='applicationSchool'
            render={({ field }) => (
              <FormItem>
                <FormLabel>报考院校</FormLabel>
                <FormControl>
                  <Input placeholder='例如：清华大学 / 北京大学' {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='applicationMajor'
            render={({ field }) => (
              <FormItem>
                <FormLabel>报考专业</FormLabel>
                <FormControl>
                  <Input
                    placeholder='例如：计算机科学与技术 / 软件工程'
                    {...field}
                  />
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
