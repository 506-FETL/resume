import PurposeFields from '../purpose-fields'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { DURATION, EASE } from '@/lib/motion'
import useShareStore from '../../store'
import { dateToExpiryIso, expiryIsoToDate, findShareById } from '../../utils'
import DateField from '../quick-dialog/date-field'
import VisibilityIcon from '../visibility-icon'

export default function SettingsDialog() {
  const reduceMotion = useReducedMotion()

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

  const [retainedShare, setRetainedShare] = useState<ResumeShareRecord | null>(
    null,
  )

  const renderedShare =
    retainedShare?.id === settingsShareId ? retainedShare : share

  const initializedShareIdRef = useRef<string | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const busy = Boolean(
    settingsShareId && pendingShareIds.includes(settingsShareId),
  )

  const [showPhone, setShowPhone] = useState(true)
  const [showEmail, setShowEmail] = useState(true)
  const [label, setLabel] = useState('')
  const [expiresAt, setExpiresAt] = useState<Date | undefined>()
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [allowComments, setAllowComments] = useState(true)
  const [password, setPassword] = useState('')

  const [showCurrentPasswordState, setShowCurrentPasswordState] =
    useState(false)

  const [showNewPassword, setShowNewPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useLayoutEffect(() => {
    if (!settingsDialogOpen) {
      initializedShareIdRef.current = null

      return
    }
    if (!share || initializedShareIdRef.current === share.id) return

    initializedShareIdRef.current = share.id
    setRetainedShare(share)
    setShowPhone(share.showPhone)
    setShowEmail(share.showEmail)
    setLabel(share?.label ?? '')
    setExpiresAt(expiryIsoToDate(share?.expires_at ?? null))
    setPasswordEnabled(Boolean(share?.has_password))
    setAllowComments(share?.allowComments ?? true)
    setPassword('')
    setShowCurrentPasswordState(false)
    setShowNewPassword(false)
    setValidationError(null)
  }, [settingsDialogOpen, share])

  const handleSave = async () => {
    if (!share) return

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
        password: passwordEnabled ? nextPassword || undefined : null,
        allowComments:
          share.purpose === 'showcase' || !showPhone || !showEmail
            ? false
            : allowComments,
        showPhone,
        showEmail,
      })

      toast.success('分享设置已更新')
      closeSettingsDialog()
    } catch {
      toast.error('保存设置失败')
    }
  }

  return (
    <Dialog
      open={settingsDialogOpen}
      onOpenChange={(open) => {
        if (!open && !busy) closeSettingsDialog()
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
        }}
        onCloseAutoFocus={(event) => {
          if (returnFocusRef.current?.isConnected) {
            event.preventDefault()
            returnFocusRef.current.focus({ preventScroll: true })
          }
        }}
        inert={!settingsDialogOpen}
        className='data-[state=closed]:pointer-events-none'
        overlayClassName={
          reduceMotion
            ? 'data-[state=open]:animate-none data-[state=closed]:animate-none'
            : undefined
        }
        style={{
          animationDuration: `${(reduceMotion ? 0 : settingsDialogOpen ? DURATION.base : DURATION.fast) * 1000}ms`,
          animationTimingFunction: `cubic-bezier(${(settingsDialogOpen ? EASE.out : EASE.in).join(',')})`,
        }}
      >
        <DialogHeader>
          <DialogTitle>编辑分享设置</DialogTitle>
          <DialogDescription className='sr-only'>
            修改分享链接和访问权限。
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className='gap-4'>
          {renderedShare?.purpose ? (
            <PurposeFields
              purpose={renderedShare.purpose}
              showPhone={showPhone}
              showEmail={showEmail}
              onShowPhoneChange={setShowPhone}
              onShowEmailChange={setShowEmail}
              disabled={busy}
            />
          ) : (
            <p className='text-sm text-muted-foreground'>
              原有分享 · 保持原来的用途与联系方式设置
            </p>
          )}
          <p className='text-xs text-muted-foreground'>
            {renderedShare?.source.kind === 'history'
              ? '当前链接固定为发布时的版本。'
              : '当前链接随云端保存更新。'}
          </p>
          <Field>
            <FieldLabel htmlFor='edit-share-label'>链接名称</FieldLabel>
            <Input
              id='edit-share-label'
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder='如：字节专用'
              maxLength={120}
            />
          </Field>

          <Field className='min-w-0'>
            <FieldLabel>有效期</FieldLabel>
            <DateField value={expiresAt} onChange={setExpiresAt} />
          </Field>

          <Field orientation='horizontal' className='rounded-lg border p-3'>
            <FieldContent>
              <FieldLabel htmlFor='edit-share-comments-enabled'>
                允许评论
              </FieldLabel>
              <FieldDescription>
                关闭并保存后，所有访问者转为只读，已有评论和草稿保留。
              </FieldDescription>
            </FieldContent>
            <Switch
              id='edit-share-comments-enabled'
              checked={
                renderedShare?.purpose !== 'showcase' &&
                showPhone &&
                showEmail &&
                allowComments
              }
              disabled={
                busy ||
                renderedShare?.purpose === 'showcase' ||
                !showPhone ||
                !showEmail
              }
              onCheckedChange={setAllowComments}
            />
          </Field>

          <Collapsible open={passwordEnabled}>
            <Field orientation='horizontal' className='rounded-lg border p-3'>
              <FieldContent>
                <FieldLabel htmlFor='edit-share-password-enabled'>
                  需要访问密码
                </FieldLabel>
                <FieldDescription>
                  保存设置后生效，已发出的链接也会同步更新。
                </FieldDescription>
              </FieldContent>
              <Switch
                id='edit-share-password-enabled'
                checked={passwordEnabled}
                disabled={busy}
                aria-controls='edit-share-password-fields'
                onCheckedChange={setPasswordEnabled}
              />
            </Field>

            <CollapsibleContent
              id='edit-share-password-fields'
              inert={!passwordEnabled || !settingsDialogOpen}
              aria-hidden={!passwordEnabled}
              style={{
                animationDuration: `${(reduceMotion ? 0 : passwordEnabled ? DURATION.base : DURATION.fast) * 1000}ms`,
                animationTimingFunction: `cubic-bezier(${(passwordEnabled ? EASE.out : EASE.in).join(',')})`,
              }}
            >
              <div className='space-y-4 pt-4'>
                {renderedShare?.has_password && (
                  <Field>
                    <FieldLabel>当前密码</FieldLabel>
                    <div className='flex min-w-0 gap-2'>
                      <Input
                        readOnly
                        value={
                          showCurrentPasswordState
                            ? '已设置（出于安全原因不可恢复明文）'
                            : '••••••••'
                        }
                        className='min-w-0'
                      />
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        aria-label={
                          showCurrentPasswordState
                            ? '隐藏当前密码状态'
                            : '显示当前密码状态'
                        }
                        onClick={() =>
                          setShowCurrentPasswordState((value) => !value)
                        }
                      >
                        <VisibilityIcon visible={showCurrentPasswordState} />
                      </Button>
                    </div>
                  </Field>
                )}
                <Field data-invalid={Boolean(validationError)}>
                  <FieldLabel htmlFor='edit-share-password'>
                    {renderedShare?.has_password
                      ? '新密码（可选）'
                      : '访问密码'}
                  </FieldLabel>
                  <div className='flex min-w-0 gap-2'>
                    <Input
                      id='edit-share-password'
                      type={showNewPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setValidationError(null)
                      }}
                      placeholder={
                        renderedShare?.has_password
                          ? '留空则保持当前密码'
                          : '请输入访问密码'
                      }
                      className='min-w-0'
                      maxLength={128}
                      autoComplete='new-password'
                      aria-invalid={Boolean(validationError)}
                    />
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      aria-label={showNewPassword ? '隐藏新密码' : '显示新密码'}
                      onClick={() => setShowNewPassword((value) => !value)}
                    >
                      <VisibilityIcon visible={showNewPassword} />
                    </Button>
                  </div>
                  {validationError && (
                    <FieldError>{validationError}</FieldError>
                  )}
                </Field>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </FieldGroup>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={closeSettingsDialog}
            disabled={busy}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={!share || busy}>
            {busy && <Spinner data-icon='inline-start' />}
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
