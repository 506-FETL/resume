import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { dateToExpiryIso, expiryIsoToDate } from '../../utils'
import AnimatedVisibilityIcon from '../animated-visibility-icon'
import ShareDateField from '../share-dialog/share-date-field'

interface ShareSettingsDialogProps {
  share: ResumeShareRecord | null
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSave: (settings: {
    label: string | null
    expiresAt: string | null
    password: string | null | undefined
  }) => Promise<void>
}

export default function ShareSettingsDialog({
  share,
  busy,
  onOpenChange,
  onSave,
}: ShareSettingsDialogProps) {
  const [label, setLabel] = useState('')
  const [expiresAt, setExpiresAt] = useState<Date | undefined>()
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [password, setPassword] = useState('')
  const [showCurrentPasswordState, setShowCurrentPasswordState] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    setLabel(share?.label ?? '')
    setExpiresAt(expiryIsoToDate(share?.expires_at ?? null))
    setPasswordEnabled(Boolean(share?.has_password))
    setPassword('')
    setShowCurrentPasswordState(false)
    setShowNewPassword(false)
    setValidationError(null)
  }, [share])

  const handleSave = async () => {
    if (!share)
      return

    const nextPassword = password.trim()
    if (passwordEnabled && !share.has_password && !nextPassword) {
      setValidationError('开启密码访问时，请输入一个访问密码。')
      return
    }

    setValidationError(null)
    await onSave({
      label: label.trim() || null,
      expiresAt: dateToExpiryIso(expiresAt),
      password: passwordEnabled
        ? (nextPassword || undefined)
        : null,
    })
  }

  return (
    <Dialog open={Boolean(share)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑分享设置</DialogTitle>
          <DialogDescription>
            修改链接名称、有效期与访问密码。保存后会在访问者下次打开或刷新同一链接时生效。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-share-label">链接名称</Label>
            <Input
              id="edit-share-label"
              value={label}
              onChange={event => setLabel(event.target.value)}
              placeholder="如：字节专用"
              maxLength={120}
            />
          </div>

          <div className="min-w-0 flex flex-col gap-1.5">
            <Label htmlFor="edit-share-expiry">有效期</Label>
            <ShareDateField value={expiresAt} onChange={setExpiresAt} />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="edit-share-password-enabled">需要访问密码</Label>
              <p className="text-xs text-muted-foreground">
                切换后会立即影响已发出的链接。
              </p>
            </div>
            <Switch
              id="edit-share-password-enabled"
              checked={passwordEnabled}
              onCheckedChange={setPasswordEnabled}
            />
          </div>

          {passwordEnabled && (
            <>
              {share?.has_password && (
                <div className="flex flex-col gap-1.5">
                  <Label>当前密码</Label>
                  <div className="relative">
                    <Input
                      readOnly
                      value={showCurrentPasswordState ? '已设置（出于安全原因不可恢复明文）' : '••••••••'}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      aria-label={showCurrentPasswordState ? '隐藏当前密码状态' : '显示当前密码状态'}
                      onClick={() => setShowCurrentPasswordState(value => !value)}
                    >
                      <AnimatedVisibilityIcon visible={showCurrentPasswordState} />
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-share-password">
                  {share?.has_password ? '新密码（可选）' : '访问密码'}
                </Label>
                <div className="relative">
                  <Input
                    id="edit-share-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder={share?.has_password ? '留空则保持当前密码' : '请输入访问密码'}
                    className="pr-10"
                    maxLength={128}
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    aria-label={showNewPassword ? '隐藏新密码' : '显示新密码'}
                    onClick={() => setShowNewPassword(value => !value)}
                  >
                    <AnimatedVisibilityIcon visible={showNewPassword} />
                  </Button>
                </div>
              </div>
            </>
          )}

          {validationError && <p className="text-sm text-destructive">{validationError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? '保存中…' : '保存设置'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
