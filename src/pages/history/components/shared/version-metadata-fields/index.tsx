import type { VersionMetadataDraft } from '../../../types'
import dayjs from 'dayjs'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useJobSummaries } from '../../../hooks/use-job-summaries'
import VersionTagInput from '../tag-input'

interface VersionMetadataFieldsProps {
  draft: VersionMetadataDraft
  onChange: (patch: Partial<VersionMetadataDraft>) => void
}

// Select 不接受空字符串值，用哨兵表示「不关联」
const NONE_COMPANY = '__none__'

export default function VersionMetadataFields({ draft, onChange }: VersionMetadataFieldsProps) {
  const { options: jobOptions } = useJobSummaries()

  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel htmlFor="version-name">版本名称</FieldLabel>
        <Input
          id="version-name"
          value={draft.versionName}
          placeholder="例如：项目优化版、字节投递版"
          maxLength={60}
          onChange={event => onChange({ versionName: event.target.value })}
        />
        <FieldDescription>为空时将自动显示为“版本 Vx”。</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="milestone-name">重点标记</FieldLabel>
        <Input
          id="milestone-name"
          value={draft.milestoneName}
          placeholder="例如：终版、春招投递版"
          maxLength={40}
          onChange={event => onChange({ milestoneName: event.target.value })}
        />
        <FieldDescription>给特别重要的一版做个标记，不填也没关系。</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="version-description">版本说明</FieldLabel>
        <Textarea
          id="version-description"
          value={draft.description}
          placeholder="记录本次保存的原因、用途或主要改动"
          rows={4}
          maxLength={240}
          onChange={event => onChange({ description: event.target.value })}
        />
        <FieldDescription>
          {draft.description.length}
          /240
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>标签</FieldLabel>
        <VersionTagInput value={draft.tags} onChange={tags => onChange({ tags })} />
        <FieldDescription>可添加多个标签，方便后续查找。</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>关联岗位</FieldLabel>
        <Select
          value={draft.companyId ?? NONE_COMPANY}
          onValueChange={value => onChange({ companyId: value === NONE_COMPANY ? null : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择投递的岗位" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_COMPANY}>不关联</SelectItem>
            {jobOptions.map(option => (
              <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>记录这一版投给了哪个岗位。</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>投递日期</FieldLabel>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start font-normal">
                <CalendarIcon data-icon="inline-start" />
                {draft.submittedAt ? draft.submittedAt : '选择日期'}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                captionLayout="dropdown"
                selected={draft.submittedAt ? dayjs(draft.submittedAt).toDate() : undefined}
                disabled={date => date > new Date()}
                onSelect={date => onChange({ submittedAt: date ? dayjs(date).format('YYYY-MM-DD') : null })}
              />
            </PopoverContent>
          </Popover>
          {draft.submittedAt && (
            <Button variant="ghost" size="icon-sm" aria-label="清除投递日期" onClick={() => onChange({ submittedAt: null })}>
              <X className="size-3.5" />
            </Button>
          )}
        </div>
        <FieldDescription>什么时候用这一版投递的。</FieldDescription>
      </Field>
    </FieldGroup>
  )
}
