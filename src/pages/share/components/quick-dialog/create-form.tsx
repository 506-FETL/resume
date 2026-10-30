import type { SharePurpose } from '@/lib/supabase/resume/share.types'
import { sharePurposeDefaults } from '@/lib/share-purpose'
import PurposeFields from '../purpose-fields'
import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import type {
  CreateShareOptions,
  ShareVersionSelection,
} from '@/lib/supabase/resume/share.types'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { dateToExpiryIso } from '../../utils'
import VersionSelector from '../version-selector'
import VisibilityIcon from '../visibility-icon'
import DateField from './date-field'

interface CreateFormProps {
  formId: string
  submitting: boolean
  onSubmittingChange: (submitting: boolean) => void
  versions: ResumeHistoryVersionListItem[]
  versionsLoading: boolean
  versionsError: string | null
  onRetryVersions: () => void
  onCreate: (
    selection: ShareVersionSelection,
    options: CreateShareOptions,
  ) => Promise<boolean>
}

export function CreateForm({
  formId,
  submitting,
  onSubmittingChange,
  versions,
  versionsLoading,
  versionsError,
  onRetryVersions,
  onCreate,
}: CreateFormProps) {
  const [selection, setSelection] = useState<ShareVersionSelection>({
    kind: 'current',
  })

  const [purpose, setPurpose] = useState<SharePurpose>('review')
  const [showPhone, setShowPhone] = useState(true)
  const [showEmail, setShowEmail] = useState(true)

  const changePurpose = (value: SharePurpose) => {
    const defaults = sharePurposeDefaults(value)

    setPurpose(value)
    setShowPhone(defaults.showPhone)
    setShowEmail(defaults.showEmail)
    setAllowComments(defaults.allowComments)
    setSelection({ kind: 'current' })
  }

  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [expiresAt, setExpiresAt] = useState<Date | undefined>()
  const [allowComments, setAllowComments] = useState(true)

  const handleCreate = async () => {
    onSubmittingChange(true)

    try {
      const created = await onCreate(selection, {
        label: label.trim() || null,
        password: password.trim() || null,
        expiresAt: dateToExpiryIso(expiresAt),
        purpose,
        showPhone,
        showEmail,
        allowComments:
          purpose === 'showcase' || !showPhone || !showEmail
            ? false
            : allowComments,
      })

      if (!created) return

      setLabel('')
      setPassword('')
      setShowPassword(false)
      setExpiresAt(undefined)
      changePurpose('review')
      setAllowComments(true)
      setSelection({ kind: 'current' })
    } finally {
      onSubmittingChange(false)
    }
  }

  return (
    <form
      id={formId}
      className='min-w-0 space-y-6'
      onSubmit={(event) => {
        event.preventDefault()

        if (!submitting) handleCreate()
      }}
    >
      <section
        className='space-y-4'
        aria-labelledby={`${formId}-purpose-heading`}
      >
        <h3 id={`${formId}-purpose-heading`} className='text-sm font-medium'>
          用途与隐私
        </h3>
        <FieldGroup className='gap-4'>
          <PurposeFields
            purpose={purpose}
            showPhone={showPhone}
            showEmail={showEmail}
            onPurposeChange={changePurpose}
            onShowPhoneChange={setShowPhone}
            onShowEmailChange={setShowEmail}
            disabled={submitting}
          />
          <Field className='min-w-0 sm:col-span-2'>
            <FieldLabel>分享版本</FieldLabel>
            <VersionSelector
              value={selection}
              freezeCurrent={purpose === 'application'}
              versions={versions}
              loading={versionsLoading}
              error={versionsError}
              disabled={submitting || purpose !== 'application'}
              onChange={setSelection}
              onRetry={onRetryVersions}
            />
          </Field>
        </FieldGroup>
      </section>
      <section
        className='space-y-4 border-t pt-5'
        aria-labelledby={`${formId}-link-heading`}
      >
        <h3 id={`${formId}-link-heading`} className='text-sm font-medium'>
          链接设置
        </h3>
        <FieldGroup className='grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2'>
          <Field className='min-w-0'>
            <FieldLabel htmlFor='share-label'>链接名称（可选）</FieldLabel>
            <Input
              id='share-label'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='如：产品经理岗位投递'
              maxLength={120}
              disabled={submitting}
            />
          </Field>
          <Field className='min-w-0'>
            <FieldLabel htmlFor='share-password'>访问密码（可选）</FieldLabel>
            <div className='flex min-w-0 gap-2'>
              <Input
                id='share-password'
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='留空则无需密码'
                className='min-w-0'
                maxLength={128}
                autoComplete='new-password'
                disabled={submitting}
              />
              <Button
                type='button'
                variant='outline'
                size='icon'
                aria-label={showPassword ? '隐藏访问密码' : '显示访问密码'}
                disabled={submitting}
                onClick={() => setShowPassword((value) => !value)}
              >
                <VisibilityIcon visible={showPassword} />
              </Button>
            </div>
          </Field>
          <Field className='min-w-0 sm:col-span-2'>
            <FieldLabel>有效期（可选）</FieldLabel>
            <DateField
              value={expiresAt}
              onChange={setExpiresAt}
              disabled={submitting}
            />
          </Field>
          <Field
            orientation='horizontal'
            className='min-w-0 border-t pt-4 sm:col-span-2'
          >
            <FieldLabel htmlFor='quick-share-comments'>
              允许访问者评论
            </FieldLabel>
            <Switch
              id='quick-share-comments'
              checked={
                purpose !== 'showcase' &&
                showPhone &&
                showEmail &&
                allowComments
              }
              disabled={
                submitting || purpose === 'showcase' || !showPhone || !showEmail
              }
              onCheckedChange={setAllowComments}
            />
          </Field>
        </FieldGroup>
      </section>
    </form>
  )
}
