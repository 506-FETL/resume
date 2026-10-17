import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { DURATION, EASE } from '@/lib/motion'
import { SignUpWithEmail } from '@/lib/supabase/user'
import { cn } from '@/lib/utils'

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const reduceMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== repeatPassword) {
      setError('两次输入的密码不匹配')
      return
    }
    setIsLoading(true)

    try {
      await SignUpWithEmail(email, password)
      setSuccess(true)
    }
    catch (error: unknown) {
      setError(error instanceof Error ? error.message : '发生错误')
    }
    finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AnimatedContent animationKey={success ? 'success' : 'form'}>
        {success
          ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">验证邮箱</CardTitle>
                  <CardDescription>请查收验证邮件，确认邮箱后再登录。</CardDescription>
                </CardHeader>
              </Card>
            )
          : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">注册</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignUp}>
                    <FieldGroup className="gap-6">
                      <Field>
                        <FieldLabel htmlFor="email">邮箱</FieldLabel>
                        <Input
                          id="email"
                          type="email"
                          placeholder="m@example.com"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="password">密码</FieldLabel>
                        <Input
                          id="password"
                          type="password"
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="repeat-password">确认密码</FieldLabel>
                        <Input
                          id="repeat-password"
                          type="password"
                          required
                          value={repeatPassword}
                          onChange={e => setRepeatPassword(e.target.value)}
                        />
                      </Field>
                      <AnimatePresence initial={false}>
                        {error && (
                          <motion.div
                            key="error"
                            initial={{ opacity: reduceMotion ? 1 : 0, height: reduceMotion ? 'auto' : 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0, transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in } }}
                            transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
                            className="overflow-hidden"
                          >
                            <FieldError>{error}</FieldError>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
                        <AnimatedContent as="span" animationKey={isLoading ? 'loading' : 'idle'} className="inline-flex items-center gap-2">
                          {isLoading && <Spinner data-icon="inline-start" />}
                          {isLoading ? '创建账户中...' : '注册'}
                        </AnimatedContent>
                      </Button>
                    </FieldGroup>
                    <div className="mt-4 text-center text-sm">
                      已有账号？
                      <Link to="/login" className="underline underline-offset-4">
                        登录
                      </Link>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
      </AnimatedContent>
    </div>
  )
}
