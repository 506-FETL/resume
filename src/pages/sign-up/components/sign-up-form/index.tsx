import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { authErrorMessage } from '@/lib/auth/feedback'
import { DURATION, EASE } from '@/lib/motion'
import { SignUpWithEmail } from '@/lib/supabase/user'
import { cn } from '@/lib/utils'

export function SignUpForm({
  className,
  redirect = '/',
  ...props
}: React.ComponentPropsWithoutRef<'div'> & { redirect?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
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
      containerRef.current?.focus({ preventScroll: true })
      setSuccess(true)
    } catch (error: unknown) {
      setError(authErrorMessage(error, '暂时无法创建账户，请稍后重试。'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={cn('flex flex-col gap-6 outline-none', className)}
      {...props}
    >
      <AnimatedContent animationKey={success ? 'success' : 'form'}>
        {success ? (
          <Card>
            <CardHeader>
              <h1 className='text-2xl leading-8 font-semibold tracking-tight'>
                验证邮箱
              </h1>
              <CardDescription>
                请查收验证邮件，确认邮箱后再登录。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className='w-full'>
                <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>
                  返回登录
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <h1 className='text-2xl leading-8 font-semibold tracking-tight'>
                注册
              </h1>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp}>
                <FieldGroup className='gap-6'>
                  <Field>
                    <FieldLabel htmlFor='email'>邮箱</FieldLabel>
                    <Input
                      id='email'
                      type='email'
                      autoComplete='email'
                      name='email'
                      placeholder='m@example.com'
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor='password'>密码</FieldLabel>
                    <Input
                      id='password'
                      type='password'
                      autoComplete='new-password'
                      name='password'
                      minLength={6}
                      aria-describedby='password-help'
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <FieldDescription id='password-help'>
                      至少 6 个字符。
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor='repeat-password'>确认密码</FieldLabel>
                    <Input
                      id='repeat-password'
                      type='password'
                      autoComplete='new-password'
                      name='repeat-password'
                      minLength={6}
                      required
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                    />
                  </Field>
                  <AnimatePresence initial={false}>
                    {error && (
                      <motion.div
                        key='error'
                        initial={{
                          opacity: reduceMotion ? 1 : 0,
                          height: reduceMotion ? 'auto' : 0,
                        }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{
                          opacity: 0,
                          height: 0,
                          transition: {
                            duration: reduceMotion ? 0 : DURATION.fast,
                            ease: EASE.in,
                          },
                        }}
                        transition={{
                          duration: reduceMotion ? 0 : DURATION.base,
                          ease: EASE.out,
                        }}
                        className='overflow-hidden'
                      >
                        <FieldError role='alert'>{error}</FieldError>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Button
                    type='submit'
                    className='w-full'
                    disabled={isLoading}
                    aria-busy={isLoading}
                  >
                    <AnimatedContent
                      as='span'
                      animationKey={isLoading ? 'loading' : 'idle'}
                      className='inline-flex items-center gap-2'
                    >
                      {isLoading && <Spinner data-icon='inline-start' />}
                      {isLoading ? '创建账户中...' : '注册'}
                    </AnimatedContent>
                  </Button>
                </FieldGroup>
                <div className='mt-4 text-center text-sm'>
                  已有账号？
                  <Link
                    to={`/login?redirect=${encodeURIComponent(redirect)}`}
                    className='underline underline-offset-4'
                  >
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
