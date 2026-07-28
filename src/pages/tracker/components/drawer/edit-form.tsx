import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { updateCompany } from '@/lib/supabase/resume'
import { COMMON_CITIES, COMMON_COMPANIES, COMMON_POSITIONS } from '../../const'
import useTrackerStore from '../../store'
import { getTrackerErrorMessage } from '../../utils'

function parseSalaryRange(salary: string): { min: string, max: string } {
  if (!salary)
    return { min: '', max: '' }
  const nums = salary.match(/\d+/g)
  if (!nums)
    return { min: '', max: '' }
  return { min: nums[0] || '', max: nums[1] || '' }
}

interface DrawerEditFormProps {
  onSaved: () => void
  onCancel: () => void
}

export default function DrawerEditForm({ onSaved, onCancel }: DrawerEditFormProps) {
  const { selectedJob, syncJob } = useTrackerStore()
  const [saving, setSaving] = useState(false)

  const parsedSalary = parseSalaryRange(selectedJob?.salary || '')

  const [formData, setFormData] = useState({
    company: selectedJob?.company || '',
    position: selectedJob?.position || '',
    location: selectedJob?.location || '',
    salaryMin: parsedSalary.min,
    salaryMax: parsedSalary.max,
    job_url: selectedJob?.job_url || '',
    company_logo: selectedJob?.company_logo || '',
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!selectedJob)
      return

    setSaving(true)

    try {
      const savedJob = await updateCompany(selectedJob.id, {
        company: formData.company,
        position: formData.position,
        location: formData.location,
        salary: formData.salaryMin && formData.salaryMax
          ? `${formData.salaryMin}K-${formData.salaryMax}K`
          : formData.salaryMin ? `${formData.salaryMin}K` : null,
        job_url: formData.job_url || null,
        company_logo: formData.company_logo.trim() || null,
      })

      syncJob(savedJob)
      onSaved()
    }
    catch (error) {
      console.error('Failed to update job:', error)
      toast.error('更新失败', { description: getTrackerErrorMessage(error) })
    }
    finally {
      setSaving(false)
    }
  }

  const isActionDisabled = saving || !selectedJob

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm">
        <h3 className="text-lg font-semibold tracking-tight">编辑信息</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          这里用于补齐职位本身的信息。流程推进和阶段备注请回到上方跟进区处理。
        </p>
      </div>

      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="company">公司名称</FieldLabel>
          <Combobox
            id="company"
            value={formData.company}
            onChange={v => handleChange('company', v)}
            options={COMMON_COMPANIES}
            placeholder="搜索或输入公司名称"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="position">职位名称</FieldLabel>
          <Combobox
            id="position"
            value={formData.position}
            onChange={v => handleChange('position', v)}
            options={COMMON_POSITIONS}
            placeholder="搜索或输入职位名称"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="location">工作地点</FieldLabel>
          <Combobox
            id="location"
            value={formData.location}
            onChange={v => handleChange('location', v)}
            options={COMMON_CITIES}
            placeholder="搜索或输入地点"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="salary-min">薪资范围</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id="salary-min"
              type="number"
              placeholder="最低"
              value={formData.salaryMin}
              onChange={e => handleChange('salaryMin', e.target.value)}
            />
            <span className="text-sm text-muted-foreground shrink-0">K ~</span>
            <Input
              id="salary-max"
              type="number"
              placeholder="最高"
              value={formData.salaryMax}
              onChange={e => handleChange('salaryMax', e.target.value)}
            />
            <span className="text-sm text-muted-foreground shrink-0">K</span>
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="job-url">JD 链接</FieldLabel>
          <Input
            id="job-url"
            placeholder="https://..."
            value={formData.job_url}
            onChange={e => handleChange('job_url', e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="company-logo">公司 Logo 链接</FieldLabel>
          <Input
            id="company-logo"
            placeholder="https://... （可选，图片地址）"
            value={formData.company_logo}
            onChange={e => handleChange('company_logo', e.target.value)}
          />
        </Field>
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
        <Button className="flex-1" onClick={() => handleSubmit()} disabled={isActionDisabled}>
          保存
        </Button>
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isActionDisabled}>
          取消
        </Button>
      </div>
    </div>
  )
}
