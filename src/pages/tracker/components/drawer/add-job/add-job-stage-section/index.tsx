import ResourcePicker from '../../resource-picker'
import type { AddJobFormData } from '../types'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ACTIVE_APPLICATION_STAGES,
  APPLICATION_STATUS_CONFIG,
  TERMINAL_APPLICATION_STATUSES,
} from '../../../../const'

interface AddJobStageSectionProps {
  formData: AddJobFormData
  onChange: (field: keyof AddJobFormData, value: string) => void
  onResumeChange: (resumeId: string | null) => void
}

export function AddJobStageSection({
  formData,
  onChange,
  onResumeChange,
}: AddJobStageSectionProps) {
  return (
    <div className='grid min-w-0 gap-4 sm:grid-cols-2'>
      <Field>
        <FieldLabel htmlFor='status' className='items-center'>
          申请状态 <span className='text-destructive'>*</span>
        </FieldLabel>
        <Select
          value={formData.status}
          onValueChange={(v) => onChange('status', v)}
        >
          <SelectTrigger className='w-full' id='status'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {[
                ...ACTIVE_APPLICATION_STAGES,
                ...TERMINAL_APPLICATION_STATUSES,
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {APPLICATION_STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor='resume-id'>准备中的简历</FieldLabel>
        <ResourcePicker
          id='resume-id'
          value={formData.resume_id || ''}
          onChange={(option) => onResumeChange(option.value)}
        />
      </Field>
    </div>
  )
}
