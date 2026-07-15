import type { DisplayType, ProficiencyLevel } from '@/lib/schema/resume/form/skillSpecialty'
import { Plus, Trash2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useIsMobile } from '@/hooks/use-mobile'
import { PRESET_SKILLS, PROFICIENCY_PERCENTAGE_MAP, skillSpecialtyFormSchema } from '@/lib/schema/resume/form/skillSpecialty'
import { cn } from '@/lib/utils'
import { RichTextFieldEditor } from '@/pages/resume/editor/components/forms/shared/rich-text-field-editor'
import useResumeStore from '@/store/resume/form'
import { useResumeFieldForm } from '../hooks/use-resume-field-form'

const proficiencyLevels: ProficiencyLevel[] = ['一般', '良好', '熟练', '擅长', '精通']
const displayTypes: { value: DisplayType, label: string }[] = [
  { value: 'text', label: '文字' },
  { value: 'percentage', label: '百分比' },
]

function SkillSpecialtyForm({ className }: { className?: string }) {
  const skillSpecialty = useResumeStore(state => state.skill_specialty)
  const jobIntentText = useResumeStore(state => state.job_intent.jobIntent)
  const isMobile = useIsMobile()
  const [customSkillInput, setCustomSkillInput] = useState('')

  const storeFormData = useMemo(() => ({
    description: skillSpecialty.description || '',
    skills: skillSpecialty.skills || [],
  }), [skillSpecialty.description, skillSpecialty.skills])

  const { form, fields, append, remove } = useResumeFieldForm({
    fieldName: 'skill_specialty',
    schema: skillSpecialtyFormSchema,
    storeFormData,
    arrayFieldName: 'skills',
  })

  // 检查预设技能是否已添加
  const isPresetSkillAdded = (skillLabel: string) => {
    return fields.some(field => field.label === skillLabel)
  }

  // 切换预设技能
  const togglePresetSkill = (skillLabel: string) => {
    const existingIndex = fields.findIndex(field => field.label === skillLabel)
    if (existingIndex >= 0) {
      remove(existingIndex)
    }
    else {
      append({
        label: skillLabel,
        proficiencyLevel: '熟练',
        displayType: 'percentage',
      } as any)
    }
  }

  // 添加自定义技能
  const addCustomSkill = () => {
    const trimmedLabel = customSkillInput.trim()
    if (!trimmedLabel) {
      toast.warning('技能名称不能为空', {
        description: '请输入有效的技能名称',
      })
      return
    }

    // 检查是否已存在
    if (fields.some(field => field.label === trimmedLabel)) {
      toast.error('技能已存在', {
        description: `"${trimmedLabel}" 已经添加过了`,
      })
      return
    }

    append({
      label: trimmedLabel,
      proficiencyLevel: '熟练',
      displayType: 'percentage',
    } as any)
    setCustomSkillInput('')
  }

  return (
    <Form {...form}>
      <form id="skill-specialty-form">
        <div className={cn('flex flex-col gap-6', className)}>
          <FormField
            name="description"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>技能特长描述</FormLabel>
                <FormControl>
                  <RichTextFieldEditor
                    sectionKey="skill_specialty"
                    relativePath="description"
                    value={field.value || ''}
                    onChange={field.onChange}
                    fieldContext={{ sectionKey: 'skill_specialty', fieldLabel: '技能特长描述', jobIntent: jobIntentText }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Separator />

          {/* 预设技能标签 */}
          <div className="flex flex-col gap-4">
            <FormLabel>快速添加技能</FormLabel>
            <div className="flex flex-wrap gap-2">
              {PRESET_SKILLS.map(skill => (
                <Button
                  key={skill}
                  type="button"
                  variant={isPresetSkillAdded(skill) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => togglePresetSkill(skill)}
                  className="h-8"
                >
                  {skill}
                  {isPresetSkillAdded(skill) && <X data-icon="inline-end" className="size-3" />}
                </Button>
              ))}
            </div>
          </div>

          {/* 自定义技能输入 */}
          <div className="flex flex-col gap-4">
            <FormLabel>添加自定义技能</FormLabel>
            <div className="flex gap-2 max-w-md">
              <Input
                placeholder="输入技能名称"
                value={customSkillInput}
                onChange={e => setCustomSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomSkill()
                  }
                }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size={isMobile ? 'sm' : 'default'} onClick={addCustomSkill}>
                <Plus data-icon="inline-start" />
                {!isMobile && <span>添加</span>}
              </Button>
            </div>
          </div>

          {/* 技能列表 */}
          {fields.length > 0 && (
            <div className="flex flex-col gap-4">
              <FormLabel>技能列表</FormLabel>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {fields.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.96, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -20 }}
                    transition={{
                      duration: 0.5,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                    layout
                    className="flex flex-col gap-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                  >
                    {/* 技能标签和删除按钮 */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-base truncate">{item.label}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="size-8 shrink-0 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>

                    {/* 熟练程度和展示方式 */}
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        name={`skills.${index}.proficiencyLevel`}
                        control={form.control}
                        render={({ field }) => (
                          <FormItem className="flex flex-col gap-1">
                            <FormLabel className="text-xs text-muted-foreground">熟练程度</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {proficiencyLevels.map(level => (
                                      <SelectItem key={level} value={level}>
                                        {level}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        name={`skills.${index}.displayType`}
                        control={form.control}
                        render={({ field }) => (
                          <FormItem className="flex flex-col gap-1">
                            <FormLabel className="text-xs text-muted-foreground">展示方式</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {displayTypes.map(type => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* 显示预览 */}
                    <div className="flex flex-col gap-2 pt-2 border-t">
                      <span className="text-sm font-semibold text-primary">
                        {(() => {
                          const proficiency = form.watch(`skills.${index}.proficiencyLevel`)
                          const displayTypeValue = form.watch(`skills.${index}.displayType`)
                          return displayTypeValue === 'percentage' && proficiency
                            ? `${PROFICIENCY_PERCENTAGE_MAP[proficiency]}%`
                            : proficiency || '熟练'
                        })()}
                      </span>
                      <Progress
                        value={PROFICIENCY_PERCENTAGE_MAP[form.watch(`skills.${index}.proficiencyLevel`)!]}
                        className="h-2"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </form>
    </Form>
  )
}

export default SkillSpecialtyForm
