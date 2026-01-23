import type { KeyboardEvent } from 'react'
import type { SkillItem } from '@/lib/schema/resume/form/skillSpecialty'
import { Plus, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { PROFICIENCY_PERCENTAGE_MAP } from '@/lib/schema/resume/form/skillSpecialty'
import { DISPLAY_TYPES, PRESET_SKILLS, PROFICIENCY_LEVELS } from '../../const'

function SkillListEditor({ value, onChange }: {
  value: SkillItem[]
  onChange: (val: SkillItem[]) => void
}) {
  const [customInput, setCustomInput] = useState('')

  const isSkillAdded = (label: string) => value.some(s => s.label === label)

  const togglePresetSkill = (label: string) => {
    if (isSkillAdded(label)) {
      onChange(value.filter(s => s.label !== label))
    }
    else {
      onChange([{ label, proficiencyLevel: '熟练', displayType: 'percentage' }, ...value])
    }
  }

  const addCustomSkill = () => {
    const trimmed = customInput.trim()
    if (!trimmed || isSkillAdded(trimmed))
      return
    onChange([{ label: trimmed, proficiencyLevel: '熟练', displayType: 'percentage' }, ...value])
    setCustomInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomSkill()
    }
  }

  const updateSkill = (index: number, updates: Partial<SkillItem>) => {
    const newValue = [...value]
    newValue[index] = { ...newValue[index], ...updates }
    onChange(newValue)
  }

  const removeSkill = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {/* 快速添加 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">快速添加</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_SKILLS.map(skill => (
            <Button
              key={skill}
              type="button"
              variant={isSkillAdded(skill) ? 'default' : 'outline'}
              size="sm"
              onClick={() => togglePresetSkill(skill)}
              className="h-7 text-xs"
            >
              {skill}
              {isSkillAdded(skill) && <X className="ml-1 size-3" />}
            </Button>
          ))}
        </div>
      </div>

      {/* 自定义添加 */}
      <div className="flex gap-2">
        <Input
          placeholder="输入自定义技能名称"
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 h-9"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCustomSkill}
          disabled={!customInput.trim()}
          className="h-9"
        >
          <Plus className="size-4 mr-1" />
          添加
        </Button>
      </div>

      {/* 技能列表 */}
      {value.length > 0 && (
        <>
          <Separator />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {value.map((skill, index) => {
                // 确保有默认值，防止空值导致 UI 异常
                const safeLevel = skill.proficiencyLevel || '熟练'
                const safePercentage = PROFICIENCY_PERCENTAGE_MAP[safeLevel as keyof typeof PROFICIENCY_PERCENTAGE_MAP] || 50

                return (
                  <motion.div
                    key={`skill-${skill.label}`}
                    layout
                    initial={{ opacity: 0, height: 0, scale: 0.9 }}
                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.9 }}
                    transition={{ opacity: { duration: 0.2 }, layout: { duration: 0.2 }, height: { duration: 0.2 } }}
                    className="flex flex-col gap-2 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow overflow-hidden"
                  >
                    {/* 标题行 */}
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{skill.label}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSkill(index)}
                        className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    {/* 选项行 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">熟练程度</label>
                        <Select
                          value={safeLevel}
                          onValueChange={v => updateSkill(index, { proficiencyLevel: v as typeof PROFICIENCY_LEVELS[number] })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROFICIENCY_LEVELS.map(level => (
                              <SelectItem key={level} value={level} className="text-xs">{level}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">展示方式</label>
                        <Select
                          value={skill.displayType}
                          onValueChange={v => updateSkill(index, { displayType: v as 'text' | 'percentage' })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DISPLAY_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value} className="text-xs">{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* 预览 */}
                    <div className="pt-2 border-t space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">预览</span>
                        <span className="font-medium text-primary">
                          {skill.displayType === 'percentage'
                            ? `${safePercentage}%`
                            : safeLevel}
                        </span>
                      </div>
                      <Progress value={safePercentage} className="h-1.5" />
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}

export default SkillListEditor
