import type { VersionMetadataDraft } from '../../../types'
import dayjs from 'dayjs'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ComponentProps } from 'react'
import { createDeferredComponent } from '@/components/deferred-content'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { LoadingStatus } from '@/components/loading-status'
import { useHistoryMotion } from '../../../hooks/use-history-motion'
import { historyComponent } from '../../../utils/load-component'
import VersionJobPicker from '../version-job-picker'
import VersionTagInput from '../tag-input'

interface VersionMetadataFieldsProps {
  draft: VersionMetadataDraft
  onChange: (patch: Partial<VersionMetadataDraft>) => void
}

const Calendar = createDeferredComponent<
  ComponentProps<typeof import('@/components/ui/calendar').Calendar>
>(
  historyComponent(() => import('@/components/ui/calendar'), 'Calendar'),
  '投递日期',
  <LoadingStatus
    label='正在加载日历'
    className='grid h-68 w-64 place-items-center'
  />,
  { wrapFallback: false },
)

export default function VersionMetadataFields({
  draft,
  onChange,
}: VersionMetadataFieldsProps) {
  const { surfaceProps } = useHistoryMotion()

  return (
    <FieldGroup {...surfaceProps} className={`${surfaceProps.className} gap-5`}>
      <Field>
        <FieldLabel htmlFor='version-name'>版本名称</FieldLabel>
        <Input
          id='version-name'
          value={draft.versionName}
          placeholder='例如：项目优化版、字节投递版'
          maxLength={60}
          onChange={(event) => onChange({ versionName: event.target.value })}
        />
        <FieldDescription>留空时显示版本号。</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor='milestone-name'>重点标记（可选）</FieldLabel>
        <Input
          id='milestone-name'
          value={draft.milestoneName}
          placeholder='例如：终版、春招投递版'
          maxLength={40}
          onChange={(event) => onChange({ milestoneName: event.target.value })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor='version-description'>版本说明</FieldLabel>
        <Textarea
          id='version-description'
          value={draft.description}
          placeholder='记录本次保存的原因、用途或主要改动'
          rows={4}
          maxLength={240}
          onChange={(event) => onChange({ description: event.target.value })}
        />
        <FieldDescription>
          {draft.description.length}
          /240
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>标签</FieldLabel>
        <VersionTagInput
          value={draft.tags}
          onChange={(tags) => onChange({ tags })}
        />
      </Field>

      <VersionJobPicker
        value={draft.companyId}
        onChange={(companyId) => onChange({ companyId })}
      />
      <Field>
        <FieldLabel>投递日期</FieldLabel>
        <div className='flex items-center gap-2'>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' className='justify-start font-normal'>
                <CalendarIcon data-icon='inline-start' />
                {draft.submittedAt ? draft.submittedAt : '选择日期'}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              {...surfaceProps}
              align='start'
              className={`${surfaceProps.className} history-popup-motion w-auto p-0`}
            >
              <Calendar
                mode='single'
                captionLayout='dropdown'
                selected={
                  draft.submittedAt
                    ? dayjs(draft.submittedAt).toDate()
                    : undefined
                }
                disabled={(date) => date > new Date()}
                onSelect={(date) =>
                  onChange({
                    submittedAt: date ? dayjs(date).format('YYYY-MM-DD') : null,
                  })
                }
              />
            </PopoverContent>
          </Popover>
          {draft.submittedAt && (
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label='清除投递日期'
              onClick={() => onChange({ submittedAt: null })}
            >
              <X className='size-3.5' />
            </Button>
          )}
        </div>
      </Field>
    </FieldGroup>
  )
}

export { VersionMetadataFields }
