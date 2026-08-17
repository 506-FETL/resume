import type { AddJobFormData } from '../types'
import { BriefcaseBusiness, FileText, MapPin } from 'lucide-react'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ResponsiveDialogSection } from '@/components/ui/responsive-dialog'
import { COMMON_CITIES, COMMON_COMPANIES, COMMON_POSITIONS } from '../../../../const'
import { TrackerCombobox } from '../../tracker-combobox'

interface AddJobFormProps {
  formData: AddJobFormData
  onChange: (field: keyof AddJobFormData, value: string) => void
}

export function AddJobForm({ formData, onChange }: AddJobFormProps) {
  return (
    <>
      <ResponsiveDialogSection id="basic" title="基本信息">
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="position" className="items-center">
              职位名称
              {' '}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <TrackerCombobox
              id="position"
              placeholder="搜索或输入职位名称"
              value={formData.position}
              onChange={value => onChange('position', value)}
              options={COMMON_POSITIONS}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="company" className="items-center">
              公司名称
              {' '}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <TrackerCombobox
              id="company"
              placeholder="搜索或输入公司名称"
              value={formData.company}
              onChange={value => onChange('company', value)}
              options={COMMON_COMPANIES}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="location" className="items-center">
              工作地点
              {' '}
              <span className="text-destructive">*</span>
            </FieldLabel>
            <TrackerCombobox
              id="location"
              placeholder="搜索或输入地点"
              value={formData.location}
              onChange={value => onChange('location', value)}
              options={COMMON_CITIES}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3 pt-2">
            <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
              <p className="inline-flex items-center gap-2 text-muted-foreground">
                <BriefcaseBusiness className="size-3.5" />
                职位名尽量写完整
              </p>
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
              <p className="inline-flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-3.5" />
                地点建议写到城市级
              </p>
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
              <p className="inline-flex items-center gap-2 text-muted-foreground">
                <FileText className="size-3.5" />
                简历可以稍后再绑定
              </p>
            </div>
          </div>
        </FieldGroup>
      </ResponsiveDialogSection>

      <ResponsiveDialogSection id="details" title="详细描述">
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="job-url">JD 链接</FieldLabel>
            <Input
              id="job-url"
              placeholder="https://..."
              value={formData.job_url}
              onChange={e => onChange('job_url', e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="company-logo">公司 Logo 链接</FieldLabel>
            <Input
              id="company-logo"
              placeholder="https://... （可选，图片地址）"
              value={formData.company_logo}
              onChange={e => onChange('company_logo', e.target.value)}
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
                onChange={e => onChange('salaryMin', e.target.value)}
              />
              <span className="text-sm text-muted-foreground shrink-0">K ~</span>
              <Input
                id="salary-max"
                type="number"
                placeholder="最高"
                value={formData.salaryMax}
                onChange={e => onChange('salaryMax', e.target.value)}
              />
              <span className="text-sm text-muted-foreground shrink-0">K</span>
            </div>
          </Field>
        </FieldGroup>
      </ResponsiveDialogSection>
    </>
  )
}
