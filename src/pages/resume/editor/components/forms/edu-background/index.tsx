import type { Degree } from '@/lib/schema'
import dayjs from 'dayjs'
import { Baby, GraduationCap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DEFAULT_EDU_BACKGROUND, eduBackgroundFormSchema } from '@/lib/schema'
import useResumeStore from '@/store/resume/form'
import { useResumeFieldForm } from '../hooks/use-resume-field-form'
import { ResumeFieldFormSection } from '../shared/resume-field-form-section'

const degreeOptions: Degree[] = ['不填', '初中', '高中', '中专', '大专', '本科', '学士', '硕士', '博士', 'MBA', 'EMBA', '其他']

function EduBackgroundForm({ className }: { className?: string }) {
  const eduBackground = useResumeStore(state => state.edu_background)
  const jobIntentText = useResumeStore(state => state.job_intent.jobIntent)
  const [isUptoNow, setIsUptoNow] = useState(() => eduBackground.items?.some(item => item.duration?.[1] === '至今') || false)

  const storeFormData = useMemo(() => ({
    items: eduBackground.items || DEFAULT_EDU_BACKGROUND.items,
  }), [eduBackground.items])

  const { form, fields, remove, onAddItem } = useResumeFieldForm({
    fieldName: 'edu_background',
    schema: eduBackgroundFormSchema,
    storeFormData,
    arrayFieldName: 'items',
    defaultItem: DEFAULT_EDU_BACKGROUND.items![0],
  })

  return (
    <ResumeFieldFormSection
      form={form}
      fields={fields}
      remove={remove}
      onAddItem={onAddItem}
      formId="edu-background-form"
      title="教育背景"
      addLabel="添加教育背景"
      className={className}
      renderItem={index => (
        <>
          <section className="grid gap-4 justify-items-start sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <FormField
              name={`items.${index}.schoolName`}
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>学校</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入学校名称" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name={`items.${index}.professional`}
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>专业</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入所学专业" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name={`items.${index}.duration`}
              control={form.control}
              render={({ field }) => {
                const start = dayjs(field.value?.[0]).isValid() ? dayjs(field.value?.[0]) : dayjs('2018-01-01')
                const end = dayjs(field.value?.[1]).isValid() ? dayjs(field.value?.[1]) : dayjs('2023-01-01')

                return (
                  <FormItem>
                    <FormLabel>就读时间</FormLabel>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                            {field.value?.[0] || '入学年月'}
                            <Baby className="ml-auto size-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            defaultMonth={start.toDate()}
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
                            {field.value?.[1] || '毕业年月'}
                            <GraduationCap className="ml-auto size-4 opacity-50" />
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
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="flex items-center">
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

            <FormField
              name={`items.${index}.degree`}
              control={form.control}
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>学历</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择学历" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {degreeOptions.map(option => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          </section>

          <FormField
            name={`items.${index}.eduInfo`}
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>教育背景描述</FormLabel>
                <FormControl>
                  <SimpleEditor
                    content={field.value || ''}
                    onChange={(editor) => {
                      field.onChange(editor.getHTML())
                    }}
                    fieldContext={{ sectionKey: 'edu_background', fieldLabel: '教育经历描述', jobIntent: jobIntentText }}
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

export default EduBackgroundForm
