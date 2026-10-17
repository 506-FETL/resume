import { useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { INVALID_RECOVERY_MESSAGE } from '../../const'
import { useRecoveryStore } from '../../store'

export function ResetPasswordForm() {
  const reduceMotion = useReducedMotion()
  const { status, error, submitting, submit } = useRecoveryStore()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <AnimatedContent animationKey={status}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{status === 'success' ? '密码已重置' : '设置新密码'}</CardTitle>
            {status === 'success' && (
              <CardDescription>当前会话仍可使用。下次登录请使用新密码。</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {status === 'ready'
              ? (
                  <form onSubmit={async (event) => {
                    event.preventDefault()
                    if (await submit(password, confirmation)) {
                      setPassword('')
                      setConfirmation('')
                    }
                  }}
                  >
                    <FieldGroup className="gap-6">
                      <Field>
                        <FieldLabel htmlFor="new-password">新密码</FieldLabel>
                        <Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={event => setPassword(event.target.value)} disabled={submitting} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="confirm-password">确认新密码</FieldLabel>
                        <Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={submitting} />
                      </Field>
                      <AnimatedContent animationKey={error ?? 'no-error'}>
                        {error && <FieldError role="alert">{error}</FieldError>}
                      </AnimatedContent>
                      <Button type="submit" className="w-full" disabled={submitting} aria-busy={submitting}>
                        <AnimatedContent as="span" animationKey={submitting ? 'loading' : 'idle'} className="inline-flex items-center gap-2">
                          {submitting && <Spinner className={reduceMotion ? 'animate-none' : undefined} />}
                          {submitting ? '正在保存…' : '保存新密码'}
                        </AnimatedContent>
                      </Button>
                    </FieldGroup>
                  </form>
                )
              : status === 'success'
                ? (
                    <Button asChild className="w-full"><Link to="/">完成，返回首页</Link></Button>
                  )
                : (
                    <div className="space-y-4">
                      <p role="alert" className="text-sm text-muted-foreground">{INVALID_RECOVERY_MESSAGE}</p>
                      <Button asChild className="w-full"><Link to="/forgot-password">重新申请重置邮件</Link></Button>
                    </div>
                  )}
          </CardContent>
        </Card>
      </AnimatedContent>
    </div>
  )
}
