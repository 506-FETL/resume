import dayjs from 'dayjs'
import { DoorOpen, Laptop } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MonthPicker } from '@/components/ui/month-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DEFAULT_WORK_EXPERIENCE, workExperienceFormSchema } from '@/lib/schema'
import { RichTextFieldEditor } from '@/pages/resume/editor/components/forms/shared/rich-text-field-editor'
import useResumeStore from '@/store/resume/form'
import { useResumeFieldForm } from '../hooks/use-resume-field-form'
import { ResumeFieldFormSection } from '../shared/resume-field-form-section'

function WorkExperienceForm({ className }: { className?: string }) {
  const workExperience = useResumeStore(state => state.work_experience)
  const jobIntentText = useResumeStore(state => state.job_intent.jobIntent)
  const [isUptoNow, setIsUptoNow] = useState(() => workExperience.items?.some(item => item.workDuration?.[1] === '至今') || false)

  const storeFormData = useMemo(() => ({
    items: workExperience.items || DEFAULT_WORK_EXPERIENCE.items,
  }), [workExperience.items])

  const { form, fields, remove, onAddItem } = useResumeFieldForm({
    fieldName: 'work_experience',
    schema: workExperienceFormSchema,
    storeFormData,
    arrayFieldName: 'items',
    defaultItem: DEFAULT_WORK_EXPERIENCE.items![0],
  })

  return (
    <ResumeFieldFormSection
      form={form}
      fields={fields}
      remove={remove}
      onAddItem={onAddItem}
      formId="work-experience-form"
      title="工作经历"
      addLabel="添加工作经历"
      className={className}
      renderItem={index => (
        <>
          <section className="grid gap-4 justify-items-start sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <FormField
              name={`items.${index}.companyName`}
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>公司名称</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入公司名称" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name={`items.${index}.position`}
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>职位</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入职位" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name={`items.${index}.workDuration`}
              control={form.control}
              render={({ field }) => {
                const start = dayjs(field.value?.[0]).isValid() ? dayjs(field.value?.[0]) : dayjs('2020-01')

                return (
                  <FormItem>
                    <FormLabel>工作时间</FormLabel>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                            {field.value?.[0] || '入职时间'}
                            <Laptop className="ml-auto size-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                          <MonthPicker
                            value={field.value?.[0]}
                            disableFuture
                            onChange={(next) => {
                              field.onChange([next, field.value?.[1]])
                            }}
                          />
                        </PopoverContent>
                      </Popover>

                      <span className="text-muted-foreground hidden sm:inline">-</span>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button disabled={isUptoNow} variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                            {field.value?.[1] || '离职时间'}
                            <DoorOpen className="ml-auto size-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                          <MonthPicker
                            value={field.value?.[1]}
                            onChange={(next) => {
                              field.onChange([field.value?.[0], next])
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="up-to-now">至今</Label>
                        <Checkbox
                          id="up-to-now"
                          checked={isUptoNow}
                          onCheckedChange={(checked) => {
                            setIsUptoNow(!!checked)
                            if (checked) {
                              field.onChange([start.format('YYYY-MM'), '至今'])
                            }
                            else {
                              field.onChange([start.format('YYYY-MM'), ''])
                            }
                          }}
                        />
                      </div>
                    </div>
                  </FormItem>
                )
              }}
            />
          </section>

          <FormField
            name={`items.${index}.workInfo`}
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>工作描述</FormLabel>
                <FormControl>
                  <RichTextFieldEditor
                    sectionKey="work_experience"
                    relativePath={`items.${index}.workInfo`}
                    value={field.value || ''}
                    onChange={field.onChange}
                    fieldContext={{ sectionKey: 'work_experience', fieldLabel: '工作描述', jobIntent: jobIntentText }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </>
      )}
    />
  )
}

export default WorkExperienceForm
