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
import supabase from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function ForgotPasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const reduceMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('/reset-password', window.location.origin).href,
      })
      if (error)
        throw error
      setSuccess(true)
    }
    catch (error: unknown) {
      setError(error instanceof Error ? error.message : '发生错误, 请稍后再试')
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
                  <CardTitle className="text-2xl">请查收邮件</CardTitle>
                  <CardDescription>如果你使用邮箱和密码注册，将收到密码重置邮件。</CardDescription>
                </CardHeader>
              </Card>
            )
          : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">重置密码</CardTitle>
                  <CardDescription>重置链接将发送至注册邮箱。</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleForgotPassword}>
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
                          {isLoading ? '发送中...' : '发送重置邮件'}
                        </AnimatedContent>
                      </Button>
                    </FieldGroup>
                    <div className="mt-4 text-center text-sm">
                      <Link to="/login" className="underline underline-offset-4">
                        返回登录
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
