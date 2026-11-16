import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import { createResumeEntryId } from '@/lib/schema/resume/entry-id'
import { skillSpecialtyFormSchema } from '@/lib/schema/resume/form/skillSpecialty'
import useResumeStore from '@/store/resume/form'
import { useResumeFieldForm } from '../hooks/use-resume-field-form'

export function useSkillSpecialty() {
  const reduceMotion = useReducedMotion()

  const [skillSpecialty] = useState(
    () => useResumeStore.getState().skill_specialty,
  )

  const jobIntentText = useResumeStore((state) => state.job_intent.jobIntent)
  const isMobile = useIsMobile()
  const [customSkillInput, setCustomSkillInput] = useState('')

  const storeFormData = useMemo(
    () => ({
      description: skillSpecialty.description || '',
      skills: skillSpecialty.skills || [],
    }),
    [skillSpecialty.description, skillSpecialty.skills],
  )

  const { form, fields, append, remove, sync } = useResumeFieldForm({
    fieldName: 'skill_specialty',
    schema: skillSpecialtyFormSchema,
    storeFormData,
    arrayFieldName: 'skills',
  })

  // 检查预设技能是否已添加
  const isPresetSkillAdded = (skillLabel: string) => {
    return fields.some((field) => field.label === skillLabel)
  }

  // 切换预设技能
  const togglePresetSkill = (skillLabel: string) => {
    const existingIndex = fields.findIndex(
      (field) => field.label === skillLabel,
    )

    if (existingIndex >= 0) {
      remove(existingIndex)
    } else {
      append({
        entryId: createResumeEntryId(),
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
      toast.warning('技能名称不能为空')

      return
    }

    // 检查是否已存在
    if (fields.some((field) => field.label === trimmedLabel)) {
      toast.error('技能已存在', {
        description: `"${trimmedLabel}" 已经添加过了`,
      })

      return
    }

    append({
      entryId: createResumeEntryId(),
      label: trimmedLabel,
      proficiencyLevel: '熟练',
      displayType: 'percentage',
    } as any)

    setCustomSkillInput('')
  }

  return {
    reduceMotion,
    jobIntentText,
    isMobile,
    customSkillInput,
    setCustomSkillInput,
    form,
    fields,
    remove,
    sync,
    isPresetSkillAdded,
    togglePresetSkill,
    addCustomSkill,
  }
}
