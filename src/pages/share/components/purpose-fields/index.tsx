import AnimatedContent from '@/components/motion/animated-content'
import type { SharePurpose } from '@/lib/supabase/resume/share.types'
import { useId } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SHARE_PURPOSE_LABELS } from '@/lib/share-purpose'

export default function PurposeFields({
  purpose,
  showPhone,
  showEmail,
  onPurposeChange,
  onShowPhoneChange,
  onShowEmailChange,
  disabled = false,
}: {
  purpose: SharePurpose
  showPhone: boolean
  showEmail: boolean
  onPurposeChange?: (purpose: SharePurpose) => void
  onShowPhoneChange: (value: boolean) => void
  onShowEmailChange: (value: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  const reduceMotion = useReducedMotion()

  return (
    <div className='min-w-0 space-y-4 sm:col-span-2'>
      <Field>
        <FieldLabel htmlFor={onPurposeChange ? `${id}-purpose` : undefined}>
          分享用途
        </FieldLabel>
        {onPurposeChange ? (
          <Select
            value={purpose}
            onValueChange={(value) => onPurposeChange(value as SharePurpose)}
            disabled={disabled}
          >
            <SelectTrigger id={`${id}-purpose`} className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position='popper'
              style={reduceMotion ? { animationDuration: '0ms' } : undefined}
            >
              {Object.entries(SHARE_PURPOSE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className='text-sm'>{SHARE_PURPOSE_LABELS[purpose]}</p>
        )}
        <AnimatedContent animationKey={purpose}>
          <p className='text-xs text-muted-foreground'>
            {purpose === 'application'
              ? '固定云端已保存的内容。生成链接后仍需单独记录投递。'
              : purpose === 'showcase'
                ? '随云端保存更新，不公开评论和附件。'
                : '随云端保存更新，可邀请他人评论。'}
          </p>
        </AnimatedContent>
      </Field>
      <Field orientation='horizontal'>
        <FieldLabel htmlFor={`${id}-phone`}>显示手机号</FieldLabel>
        <Switch
          id={`${id}-phone`}
          className={
            reduceMotion
              ? 'transition-none [&_[data-slot=switch-thumb]]:transition-none'
              : undefined
          }
          checked={showPhone}
          onCheckedChange={onShowPhoneChange}
          disabled={disabled}
        />
      </Field>
      <Field orientation='horizontal'>
        <FieldLabel htmlFor={`${id}-email`}>显示邮箱</FieldLabel>
        <Switch
          id={`${id}-email`}
          className={
            reduceMotion
              ? 'transition-none [&_[data-slot=switch-thumb]]:transition-none'
              : undefined
          }
          checked={showEmail}
          onCheckedChange={onShowEmailChange}
          disabled={disabled}
        />
      </Field>
      <p className='text-xs text-muted-foreground'>
        公开展示或隐藏联系方式时，访问者不能读取评论和附件。
      </p>
    </div>
  )
}
