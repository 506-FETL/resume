import { useState } from 'react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { COMMON_CITIES, COMMON_POSITIONS } from '../../const'
import { isTrackerAccountScopeError } from '../../lib/account-scope'
import useTrackerStore, { getTrackerConflictAction } from '../../store'
import { getTrackerErrorMessage } from '../../utils'
import { TrackerCombobox } from './tracker-combobox'
import { CompanyPicker } from './company-picker'

function parseSalaryRange(salary: string): { min: string; max: string } {
  if (!salary) return { min: '', max: '' }

  const nums = salary.match(/\d+/g)

  if (!nums) return { min: '', max: '' }

  return { min: nums[0] || '', max: nums[1] || '' }
}

interface DrawerEditFormProps {
  onSaved: () => void
  onCancel: () => void
}

export default function DrawerEditForm({
  onSaved,
  onCancel,
}: DrawerEditFormProps) {
  const { selectedJob, saveJobFields, reassignCompany, referralSource } =
    useTrackerStore(
      useShallow((state) => ({
        selectedJob: state.selectedJob,
        saveJobFields: state.saveJobFields,
        reassignCompany: state.reassignCompany,
        referralSource: state.jobs.find(
          (job) => job.id === state.selectedJob?.referred_from_job_id,
        ),
      })),
    )

  const [saving, setSaving] = useState(false)

  const parsedSalary = parseSalaryRange(selectedJob?.salary || '')

  const [formData, setFormData] = useState({
    tracker_company_id: selectedJob?.tracker_company_id ?? null,
    recruitment_batch: selectedJob?.recruitment_batch ?? '',
    position: selectedJob?.position || '',
    location: selectedJob?.location || '',
    salaryMin: parsedSalary.min,
    salaryMax: parsedSalary.max,
    job_url: selectedJob?.job_url || '',
    jd_text: selectedJob?.jd_text || '',
    source: selectedJob?.source || '',
  })

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (
      !selectedJob ||
      !formData.tracker_company_id ||
      !formData.position.trim()
    )
      return

    setSaving(true)

    try {
      if (formData.tracker_company_id !== selectedJob.tracker_company_id)
        await reassignCompany(selectedJob.id, formData.tracker_company_id)

      await saveJobFields(selectedJob.id, {
        recruitment_batch: formData.recruitment_batch.trim() || null,
        position: formData.position,
        location: formData.location,
        salary:
          formData.salaryMin && formData.salaryMax
            ? `${formData.salaryMin}K-${formData.salaryMax}K`
            : formData.salaryMin
              ? `${formData.salaryMin}K`
              : null,
        job_url: formData.job_url || null,
        jd_text: formData.jd_text.trim() || null,
        source: formData.source.trim() || null,
      })

      onSaved()
    } catch (error) {
      if (isTrackerAccountScopeError(error)) return

      console.error('Failed to update job:', error)

      toast.error('更新失败', {
        description: getTrackerErrorMessage(error),
        action: getTrackerConflictAction(error, onCancel),
      })
    } finally {
      setSaving(false)
    }
  }

  const isActionDisabled = saving || !selectedJob

  return (
    <div className='flex flex-col gap-4'>
      <FieldGroup className='gap-3'>
        <Field>
          <FieldLabel htmlFor='company'>公司名称</FieldLabel>
          <CompanyPicker
            id='company'
            value={formData.tracker_company_id}
            onChange={(id) =>
              setFormData((current) => ({ ...current, tracker_company_id: id }))
            }
            disabled={saving}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='edit-recruitment-batch'>
            招聘批次（选填）
          </FieldLabel>
          <Input
            id='edit-recruitment-batch'
            value={formData.recruitment_batch}
            onChange={(event) =>
              handleChange('recruitment_batch', event.target.value)
            }
          />
        </Field>
        {selectedJob?.referred_from_job_id && (
          <p className='text-xs text-muted-foreground'>
            来自「{referralSource?.position ?? '原岗位'}」的转岗 / 推荐。
          </p>
        )}

        <Field>
          <FieldLabel htmlFor='position'>职位名称</FieldLabel>
          <TrackerCombobox
            id='position'
            value={formData.position}
            onChange={(value) => handleChange('position', value)}
            options={COMMON_POSITIONS}
            placeholder='搜索或输入职位名称'
          />
        </Field>

        <Field>
          <FieldLabel htmlFor='location'>工作地点</FieldLabel>
          <TrackerCombobox
            id='location'
            value={formData.location}
            onChange={(value) => handleChange('location', value)}
            options={COMMON_CITIES}
            placeholder='搜索或输入地点'
          />
        </Field>

        <Field>
          <FieldLabel htmlFor='salary-min'>薪资范围</FieldLabel>
          <div className='flex items-center gap-2'>
            <Input
              id='salary-min'
              type='number'
              placeholder='最低'
              value={formData.salaryMin}
              onChange={(e) => handleChange('salaryMin', e.target.value)}
            />
            <span className='text-sm text-muted-foreground shrink-0'>K ~</span>
            <Input
              id='salary-max'
              type='number'
              placeholder='最高'
              value={formData.salaryMax}
              onChange={(e) => handleChange('salaryMax', e.target.value)}
            />
            <span className='text-sm text-muted-foreground shrink-0'>K</span>
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor='job-url'>JD 链接</FieldLabel>
          <Input
            id='job-url'
            placeholder='https://...'
            value={formData.job_url}
            onChange={(e) => handleChange('job_url', e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor='edit-job-source'>岗位来源</FieldLabel>
          <Input
            id='edit-job-source'
            value={formData.source}
            onChange={(event) => handleChange('source', event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='edit-job-jd'>JD 原文</FieldLabel>
          <Textarea
            id='edit-job-jd'
            maxLength={30000}
            value={formData.jd_text}
            onChange={(event) => handleChange('jd_text', event.target.value)}
          />
        </Field>
      </FieldGroup>

      <div className='flex flex-col-reverse gap-2 pt-2 sm:flex-row'>
        <Button
          className='flex-1'
          onClick={() => handleSubmit()}
          disabled={isActionDisabled}
        >
          保存
        </Button>
        <Button
          variant='outline'
          className='flex-1'
          onClick={onCancel}
          disabled={isActionDisabled}
        >
          取消
        </Button>
      </div>
    </div>
  )
}
