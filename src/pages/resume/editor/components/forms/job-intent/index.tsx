import type { DateEntry } from '@/lib/schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { motion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useResumeFormSync } from '@/hooks/collab/use-resume-form-sync'
import { jobIntentFormSchema } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useResumeStore from '@/store/resume/form'

const dateEntryOptions: DateEntry[] = ['不填', '随时到岗', '15天内', '1个月内', '2个月内', '3个月内', '到岗时间另行商议']

function JobIntentForm({ className }: { className?: string }) {
  const jobIntent = useResumeStore(state => state.job_intent)

  const form = useForm({
    resolver: zodResolver(jobIntentFormSchema),
    defaultValues: jobIntent,
    mode: 'onChange',
    reValidateMode: 'onChange',
  })

  // 远程协作字段级双向同步（含同字段并发的光标保持）
  useResumeFormSync(form, 'job_intent', jobIntent)

  return (
    <Form {...form}>
      <form id="job-intent-form" className={cn(className)}>
        <motion.div layout className="grid gap-4 justify-items-start @sm/panel:grid-cols-2 @2xl/panel:grid-cols-4">
          <FormField
            control={form.control}
            name="jobIntent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>期望岗位</FormLabel>
                <FormControl>
                  <Input placeholder="例如：前端开发 / 全栈" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="intentionalCity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>意向城市</FormLabel>
                <FormControl>
                  <Input placeholder="例如：上海 / 杭州 / 远程" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expectedSalary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>期望薪资 (K/月)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern={REGEXP_ONLY_DIGITS}
                    placeholder="例如：20"
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (Number(v) < 0) {
                        toast.error('倒贴上班吗，有点意思')
                      }
                      field.onChange(v && Number(v))
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dateEntry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>到岗时间</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="不填" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      {dateEntryOptions.map(opt => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </motion.div>
      </form>
    </Form>
  )
}

export default JobIntentForm
