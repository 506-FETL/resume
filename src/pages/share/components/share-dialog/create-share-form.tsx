import type { CreateShareOptions } from '@/lib/supabase/resume/share.types'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dateToExpiryIso } from '../../utils'
import AnimatedVisibilityIcon from '../animated-visibility-icon'
import ShareDateField from './share-date-field'

interface CreateShareFormProps {
  onCreate: (options: CreateShareOptions) => Promise<boolean>
}

export function CreateShareForm({ onCreate }: CreateShareFormProps) {
  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [expiresAt, setExpiresAt] = useState<Date | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async () => {
    setSubmitting(true)
    try {
      const created = await onCreate({
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
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-w-0 flex flex-col gap-3 rounded-lg border p-4">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 flex flex-col gap-1.5">
          <Label htmlFor="share-label" className="text-xs">链接名称（可选）</Label>
          <Input
            id="share-label"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="如：字节专用"
            maxLength={120}
          />
        </div>
        <div className="min-w-0 flex flex-col gap-1.5">
          <Label htmlFor="share-password" className="text-xs">访问密码（可选）</Label>
          <div className="relative">
            <Input
              id="share-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="留空则开即看"
              className="pr-10"
              maxLength={128}
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              aria-label={showPassword ? '隐藏访问密码' : '显示访问密码'}
              onClick={() => setShowPassword(value => !value)}
            >
              <AnimatedVisibilityIcon visible={showPassword} />
            </Button>
          </div>
        </div>
        <div className="min-w-0 flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="share-expiry" className="text-xs">有效期（可选）</Label>
          <ShareDateField value={expiresAt} onChange={setExpiresAt} />
        </div>
      </div>
      <Button onClick={handleCreate} disabled={submitting} className="self-start">
        {submitting ? <Loader2 className="size-4 animate-spin" data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
        生成分享链接
      </Button>
    </div>
  )
}
