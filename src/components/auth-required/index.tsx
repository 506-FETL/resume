import type { ReactNode } from 'react'
import { LogIn } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Link, useLocation } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import useUserStore from '@/store/user'

interface AuthRequiredProps {
  title: string
  description: string
  children: ReactNode
}

/** 登录态确认前不挂载云端页面，避免将访客误判为加载中或请求失败。 */
export function AuthRequired({
  title,
  description,
  children,
}: AuthRequiredProps) {
  const authStatus = useUserStore((state) => state.authStatus)
  const reduceMotion = useReducedMotion()
  const location = useLocation()
  const redirect = `${location.pathname}${location.search}${location.hash}`

  return (
    <AnimatedContent animationKey={authStatus} className='h-full min-h-0'>
      {authStatus === 'unknown' ? (
        <div
          role='status'
          aria-label='正在确认登录状态'
          className='flex min-h-80 flex-col items-center justify-center gap-4 p-6'
        >
          <Skeleton
            className={cn('size-12 rounded-xl', reduceMotion && 'animate-none')}
          />
          <Skeleton
            className={cn('h-6 w-48', reduceMotion && 'animate-none')}
          />
          <span className='sr-only'>正在确认登录状态</span>
        </div>
      ) : authStatus === 'anonymous' ? (
        <div className='mx-auto flex min-h-80 w-full max-w-5xl items-center px-2 py-6 sm:min-h-105 sm:px-6'>
          <Empty className='min-h-80 rounded-2xl border bg-card px-6'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <LogIn />
              </EmptyMedia>
              <EmptyTitle role='heading' aria-level={1}>
                {title}
              </EmptyTitle>
              <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>
                  <LogIn data-icon='inline-start' />
                  去登录
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        children
      )}
    </AnimatedContent>
  )
}
