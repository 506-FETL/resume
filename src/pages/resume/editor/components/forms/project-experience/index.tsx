import dayjs from 'dayjs'
import { DoorOpen, Laptop } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DEFAULT_PROJECT_EXPERIENCE, projectExperienceFormSchema } from '@/lib/schema'
import useResumeStore from '@/store/resume/form'
import { useResumeFieldForm } from '../hooks/use-resume-field-form'
import { ResumeFieldFormSection } from '../shared/resume-field-form-section'

function ProjectExperienceForm({ className }: { className?: string }) {
  const projectExperience = useResumeStore(state => state.project_experience)
  const jobIntentText = useResumeStore(state => state.job_intent.jobIntent)
  const [isUptoNow, setIsUptoNow] = useState(() => projectExperience.items?.some(item => item.projectDuration?.[1] === '至今') || false)

  const storeFormData = useMemo(() => ({
    items: projectExperience.items || DEFAULT_PROJECT_EXPERIENCE.items,
  }), [projectExperience.items])

  const { form, fields, remove, onAddItem } = useResumeFieldForm({
    fieldName: 'project_experience',
    schema: projectExperienceFormSchema,
    storeFormData,
    arrayFieldName: 'items',
    defaultItem: DEFAULT_PROJECT_EXPERIENCE.items![0],
  })

  return (
    <ResumeFieldFormSection
      form={form}
      fields={fields}
      remove={remove}
      onAddItem={onAddItem}
      formId="project-experience-form"
      title="项目经验"
      addLabel="添加项目经验"
      className={className}
      renderItem={index => (
        <>
          <section className="grid gap-4 justify-items-start sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <FormField
              name={`items.${index}.projectName`}
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>项目名称</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入项目名称" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name={`items.${index}.participantRole`}
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>参与角色</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入参与角色" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name={`items.${index}.projectDuration`}
              control={form.control}
              render={({ field }) => {
                const start = dayjs(field.value?.[0]).isValid() ? dayjs(field.value?.[0]) : dayjs('2023-01-01')
                const end = dayjs(field.value?.[1]).isValid() ? dayjs(field.value?.[1]) : dayjs('2024-09-01')

                return (
                  <FormItem>
                    <FormLabel>项目时间</FormLabel>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                            {field.value?.[0] || '开始时间'}
                            <Laptop className="ml-auto size-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            defaultMonth={start.toDate()}
                            disabled={date => date > new Date()}
                            selected={start.toDate()}
                            onSelect={(date) => {
                              field.onChange([dayjs(date).format('YYYY-MM-DD'), end.format('YYYY-MM-DD')])
                            }}
                          />
                        </PopoverContent>
                      </Popover>

                      <span className="text-muted-foreground hidden sm:inline">-</span>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button disabled={isUptoNow} variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                            {field.value?.[1] || '结束时间'}
                            <DoorOpen className="ml-auto size-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            defaultMonth={end.toDate()}
                            endMonth={new Date(2035, 11)}
                            selected={end.toDate()}
                            onSelect={(date) => {
                              field.onChange([start.format('YYYY-MM-DD'), dayjs(date).format('YYYY-MM-DD')])
                            }}
                            disabled={date => date > new Date()}
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
                              field.onChange([start.format('YYYY-MM-DD'), '至今'])
                            }
                            else {
                              field.onChange([start.format('YYYY-MM-DD'), ''])
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
            name={`items.${index}.projectInfo`}
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>项目经验描述</FormLabel>
                <FormControl>
                  <SimpleEditor
                    content={field.value || ''}
                    onChange={(editor) => {
                      field.onChange(editor.getHTML())
                    }}
                    fieldContext={{ sectionKey: 'project_experience', fieldLabel: '项目描述', jobIntent: jobIntentText }}
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

export default ProjectExperienceForm
