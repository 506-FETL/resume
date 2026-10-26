import type { ResumeOption } from '../../types'
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
  resumes: ResumeOption[]
  loadingResumes: boolean
}

export function AddJobStageSection({
  formData,
  onChange,
  onResumeChange,
  resumes,
  loadingResumes,
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
        <Select
          value={formData.resume_id || ''}
          onValueChange={(v) => onResumeChange(v || null)}
          disabled={loadingResumes}
        >
          <SelectTrigger id='resume-id'>
            <SelectValue
              placeholder={loadingResumes ? '加载中...' : '选择简历'}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {resumes.map((r) => (
                <SelectItem key={r.resume_id} value={r.resume_id}>
                  {r.display_name}
                  {r.type === 'default' && ' (默认)'}
                </SelectItem>
              ))}
            </SelectGroup>
            {resumes.length === 0 && !loadingResumes && (
              <div className='px-2 py-1.5 text-sm text-muted-foreground'>
                暂无简历
              </div>
            )}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}
