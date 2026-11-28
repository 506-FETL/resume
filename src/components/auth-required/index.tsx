import type { ReactNode } from 'react'
import { LogIn } from 'lucide-react'
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
import { RouteSkeleton } from '@/components/route-skeleton'
import { PageLayout } from '@/components/layout/page-layout'
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
  const location = useLocation()
  const redirect = `${location.pathname}${location.search}${location.hash}`

  return (
    <AnimatedContent
      animationKey={authStatus === 'anonymous' ? 'anonymous' : 'content'}
      className='h-full min-h-0'
    >
      {authStatus === 'unknown' ? (
        <RouteSkeleton
          pathname={location.pathname}
          location={location}
          label='正在确认登录状态'
        />
      ) : authStatus === 'anonymous' ? (
        <PageLayout>
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
        </PageLayout>
      ) : (
        children
      )}
    </AnimatedContent>
  )
}
