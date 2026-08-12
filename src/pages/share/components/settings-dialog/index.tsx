import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import useShareStore from '../../store'
import { dateToExpiryIso, expiryIsoToDate, findShareById } from '../../utils'
import DateField from '../quick-dialog/date-field'
import VisibilityIcon from '../visibility-icon'

export default function SettingsDialog() {
  const {
    allShares,
    shares,
    settingsDialogOpen,
    settingsShareId,
    pendingShareIds,
    closeSettingsDialog,
    updateSettings,
  } = useShareStore()
  const share = findShareById(allShares, shares, settingsShareId)
  const [retainedShare, setRetainedShare] = useState<ResumeShareRecord | null>(null)
  const renderedShare = share ?? retainedShare
  const busy = Boolean(settingsShareId && pendingShareIds.includes(settingsShareId))
  const [label, setLabel] = useState('')
  const [expiresAt, setExpiresAt] = useState<Date | undefined>()
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [password, setPassword] = useState('')
  const [showCurrentPasswordState, setShowCurrentPasswordState] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (share)
      setRetainedShare(share)
  }, [share])

  useEffect(() => {
    if (!settingsDialogOpen)
      return

    setLabel(share?.label ?? '')
    setExpiresAt(expiryIsoToDate(share?.expires_at ?? null))
    setPasswordEnabled(Boolean(share?.has_password))
    setPassword('')
    setShowCurrentPasswordState(false)
    setShowNewPassword(false)
    setValidationError(null)
  }, [settingsDialogOpen, share])

  const handleSave = async () => {
    if (!share)
      return

    const nextPassword = password.trim()
    if (passwordEnabled && !share.has_password && !nextPassword) {
      setValidationError('开启密码访问时，请输入一个访问密码。')
      return
    }

    setValidationError(null)
    try {
      await updateSettings(share.id, {
        label: label.trim() || null,
        expiresAt: dateToExpiryIso(expiresAt),
        password: passwordEnabled
          ? (nextPassword || undefined)
          : null,
      })
      toast.success('分享设置已更新')
      closeSettingsDialog()
    }
    catch {
      toast.error('保存设置失败')
    }
  }

  return (
    <Dialog
      open={settingsDialogOpen}
      onOpenChange={(open) => {
        if (!open)
          closeSettingsDialog()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑分享设置</DialogTitle>
          <DialogDescription>
            修改链接名称、有效期与访问密码。保存后会在访问者下次打开或刷新同一链接时生效。
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="edit-share-label">链接名称</FieldLabel>
            <Input
              id="edit-share-label"
              value={label}
              onChange={event => setLabel(event.target.value)}
              placeholder="如：字节专用"
              maxLength={120}
            />
          </Field>

          <Field className="min-w-0">
            <FieldLabel>有效期</FieldLabel>
            <DateField value={expiresAt} onChange={setExpiresAt} />
          </Field>

          <Field orientation="horizontal" className="rounded-lg border p-3">
            <FieldContent>
              <FieldLabel htmlFor="edit-share-password-enabled">需要访问密码</FieldLabel>
              <FieldDescription>切换后会立即影响已发出的链接。</FieldDescription>
            </FieldContent>
            <Switch
              id="edit-share-password-enabled"
              checked={passwordEnabled}
              disabled={busy}
              onCheckedChange={setPasswordEnabled}
            />
          </Field>

          {passwordEnabled && (
            <>
              {renderedShare?.has_password && (
                <Field>
                  <FieldLabel>当前密码</FieldLabel>
                  <div className="flex min-w-0 gap-2">
                    <Input
                      readOnly
                      value={showCurrentPasswordState ? '已设置（出于安全原因不可恢复明文）' : '••••••••'}
                      className="min-w-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={showCurrentPasswordState ? '隐藏当前密码状态' : '显示当前密码状态'}
                      onClick={() => setShowCurrentPasswordState(value => !value)}
                    >
                      <VisibilityIcon visible={showCurrentPasswordState} />
                    </Button>
                  </div>
                </Field>
              )}
              <Field data-invalid={Boolean(validationError)}>
                <FieldLabel htmlFor="edit-share-password">
                  {renderedShare?.has_password ? '新密码（可选）' : '访问密码'}
                </FieldLabel>
                <div className="flex min-w-0 gap-2">
                  <Input
                    id="edit-share-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setValidationError(null)
                    }}
                    placeholder={renderedShare?.has_password ? '留空则保持当前密码' : '请输入访问密码'}
                    className="min-w-0"
                    maxLength={128}
                    autoComplete="new-password"
                    aria-invalid={Boolean(validationError)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={showNewPassword ? '隐藏新密码' : '显示新密码'}
                    onClick={() => setShowNewPassword(value => !value)}
                  >
                    <VisibilityIcon visible={showNewPassword} />
                  </Button>
                </div>
                {validationError && <FieldError>{validationError}</FieldError>}
              </Field>
            </>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={closeSettingsDialog} disabled={busy}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!share || busy}>
            {busy && <Spinner data-icon="inline-start" />}
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
