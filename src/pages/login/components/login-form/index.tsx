import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { DURATION, EASE } from '@/lib/motion'
import { SignInWithEmailAndPassword } from '@/lib/supabase/user'
import { cn } from '@/lib/utils'
import useUserStore from '@/store/user'

interface LoginFormProps extends React.ComponentPropsWithoutRef<'div'> {
  redirect: string
}

export function LoginForm({ redirect, className, ...props }: LoginFormProps) {
  const reduceMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const user = await SignInWithEmailAndPassword(email, password)
      useUserStore.getState().setCurrentUser(user)

      navigate(redirect, { replace: true })
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
      <Card>
        <CardHeader>
          <h1 className="text-2xl leading-8 font-semibold tracking-tight">登录</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
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
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="password">密码</FieldLabel>
                  <Link
                    to="/forgot-password"
                    className="text-sm underline-offset-4 hover:underline"
                  >
                    忘记密码？
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
                  {isLoading ? '登录中...' : '登录'}
                </AnimatedContent>
              </Button>
            </FieldGroup>
            <div className="mt-4 text-center text-sm">
              还没有账号？
              <Link to="/sign-up" className="underline underline-offset-4">
                注册
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
