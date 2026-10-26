import type { ReactNode } from 'react'
import type { AddJobFormData } from '../types'
import { ChevronDown } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DURATION, EASE } from '@/lib/motion'
import {
  COMMON_CITIES,
  COMMON_COMPANIES,
  COMMON_POSITIONS,
} from '../../../../const'
import { TrackerCombobox } from '../../tracker-combobox'

interface AddJobFormProps {
  formData: AddJobFormData
  onChange: (field: keyof AddJobFormData, value: string) => void
  children?: ReactNode
}

export function AddJobForm({ formData, onChange, children }: AddJobFormProps) {
  const reduceMotion = useReducedMotion()

  const motionStyle = {
    animationDuration: `${reduceMotion ? 0 : DURATION.base}s`,
    animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
  }

  return (
    <div className='space-y-5'>
      <FieldGroup className='gap-4'>
        <Field>
          <FieldLabel htmlFor='position'>
            职位名称
            <span className='text-destructive'>*</span>
          </FieldLabel>
          <TrackerCombobox
            id='position'
            placeholder='搜索或输入职位名称'
            value={formData.position}
            onChange={(value) => onChange('position', value)}
            options={COMMON_POSITIONS}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='company'>
            公司名称
            <span className='text-destructive'>*</span>
          </FieldLabel>
          <TrackerCombobox
            id='company'
            placeholder='搜索或输入公司名称'
            value={formData.company}
            onChange={(value) => onChange('company', value)}
            options={COMMON_COMPANIES}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='location'>工作地点</FieldLabel>
          <TrackerCombobox
            id='location'
            placeholder='搜索或输入城市'
            value={formData.location}
            onChange={(value) => onChange('location', value)}
            options={COMMON_CITIES}
          />
        </Field>
      </FieldGroup>
      <Field>
        <FieldLabel htmlFor='new-job-jd'>JD 原文（选填）</FieldLabel>
        <Textarea
          id='new-job-jd'
          value={formData.jd_text}
          maxLength={30000}
          onChange={(event) => onChange('jd_text', event.target.value)}
          placeholder='粘贴岗位描述，可免费提取基本字段，也可以直接手填'
        />
      </Field>
      {children}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            className='group w-full justify-between px-0 text-muted-foreground hover:bg-transparent'
          >
            更多信息（选填）
            <ChevronDown
              className='size-4 transition-transform group-data-[state=open]:rotate-180'
              style={{
                transitionDuration: `${reduceMotion ? 0 : DURATION.fast}s`,
              }}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent style={motionStyle}>
          <FieldGroup className='gap-4 pt-3 pb-1'>
            <Field>
              <FieldLabel htmlFor='job-url'>JD 链接</FieldLabel>
              <Input
                id='job-url'
                placeholder='https://...'
                value={formData.job_url}
                onChange={(e) => onChange('job_url', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor='job-source'>岗位来源</FieldLabel>
              <Input
                id='job-source'
                placeholder='招聘网站、内推等'
                value={formData.source}
                onChange={(e) => onChange('source', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor='salary-min'>薪资范围</FieldLabel>
              <div className='flex items-center gap-2'>
                <Input
                  id='salary-min'
                  className='min-w-0'
                  type='number'
                  placeholder='最低'
                  value={formData.salaryMin}
                  onChange={(e) => onChange('salaryMin', e.target.value)}
                />
                <span className='shrink-0 text-sm text-muted-foreground'>
                  K ~
                </span>
                <Input
                  id='salary-max'
                  aria-label='最高薪资'
                  className='min-w-0'
                  type='number'
                  placeholder='最高'
                  value={formData.salaryMax}
                  onChange={(e) => onChange('salaryMax', e.target.value)}
                />
                <span className='shrink-0 text-sm text-muted-foreground'>
                  K
                </span>
              </div>
            </Field>
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
