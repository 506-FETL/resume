import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import type { CreateShareOptions, ShareVersionSelection } from '@/lib/supabase/resume/share.types'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { dateToExpiryIso } from '../../utils'
import VersionSelector from '../version-selector'
import VisibilityIcon from '../visibility-icon'
import DateField from './date-field'

interface CreateFormProps {
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
  versions,
  versionsLoading,
  versionsError,
  onRetryVersions,
  onCreate,
}: CreateFormProps) {
  const [selection, setSelection] = useState<ShareVersionSelection>({ kind: 'current' })
  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [expiresAt, setExpiresAt] = useState<Date | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async () => {
    setSubmitting(true)
    try {
      const created = await onCreate(selection, {
        label: label.trim() || null,
        password: password.trim() || null,
        expiresAt: dateToExpiryIso(expiresAt),
      })
      if (!created)
        return
      setLabel('')
      setPassword('')
      setShowPassword(false)
      setExpiresAt(undefined)
      setSelection({ kind: 'current' })
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-w-0 flex flex-col gap-3 rounded-lg border p-4">
      <FieldGroup className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <Field className="min-w-0 sm:col-span-2">
          <FieldLabel>分享版本</FieldLabel>
          <VersionSelector
            value={selection}
            versions={versions}
            loading={versionsLoading}
            error={versionsError}
            disabled={submitting}
            onChange={setSelection}
            onRetry={onRetryVersions}
          />
        </Field>
        <Field className="min-w-0">
          <FieldLabel htmlFor="share-label">链接名称（可选）</FieldLabel>
          <Input
            id="share-label"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="如：字节专用"
            maxLength={120}
          />
        </Field>
        <Field className="min-w-0">
          <FieldLabel htmlFor="share-password">访问密码（可选）</FieldLabel>
          <div className="flex min-w-0 gap-2">
            <Input
              id="share-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="留空则开即看"
              className="min-w-0"
              maxLength={128}
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={showPassword ? '隐藏访问密码' : '显示访问密码'}
              onClick={() => setShowPassword(value => !value)}
            >
              <VisibilityIcon visible={showPassword} />
            </Button>
          </div>
        </Field>
        <Field className="min-w-0 sm:col-span-2">
          <FieldLabel>有效期（可选）</FieldLabel>
          <DateField value={expiresAt} onChange={setExpiresAt} />
        </Field>
      </FieldGroup>
      <Button onClick={handleCreate} disabled={submitting} className="self-start">
        {submitting ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
        生成分享链接
      </Button>
    </div>
  )
}
