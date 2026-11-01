import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { AnimatedContent } from '@/components/motion/animated-content'
import { QuotaCard } from '@/components/quota/quota-card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/supabase/user'
import { getErrorMessage } from '@/utils'
import { AccountSettingsCard } from './components/account-settings-card'
import { PreferencesCard } from './components/preferences-card'
import { ProfileInfoCard } from './components/profile-info-card'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true)

        const currentUser = await getCurrentUser()

        if (!currentUser) {
          navigate('/login')

          return
        }

        setUser(currentUser)
      } catch (error: unknown) {
        toast.error(`用户信息加载失败：${getErrorMessage(error)}`)
        navigate('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [navigate])

  return (
    <AnimatedContent animationKey={!user || loading ? 'loading' : 'ready'}>
      {!user || loading ? (
        <ProfilePageSkeleton />
      ) : (
        <PageLayout width='narrow'>
          <PageHeader
            title='个人信息'
            description='管理个人资料、账户安全与使用偏好。'
          />

          <ProfileInfoCard user={user} />
          <AccountSettingsCard user={user} />
          <QuotaCard />
          <PreferencesCard />
        </PageLayout>
      )}
    </AnimatedContent>
  )
}

function ProfilePageSkeleton() {
  return (
    <PageLayout width='narrow' aria-label='正在加载个人信息' aria-busy='true'>
      <PageHeader
        title='个人信息'
        description='管理个人资料、账户安全与使用偏好。'
      />
      <div className='flex flex-col gap-5 border-b pb-6'>
        <Skeleton className='h-6 w-24' />
        <div className='flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6'>
          <Skeleton className='size-24 shrink-0 rounded-full' />
          <Skeleton className='h-5 w-24' />
        </div>
        <div className='divide-y'>
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className='grid gap-2 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center'
            >
              <Skeleton className='h-5 w-20' />
              <div className='flex min-w-0 items-center justify-between gap-2'>
                <Skeleton className='h-6 w-full max-w-56' />
                {item < 2 && <Skeleton className='size-9 shrink-0' />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className='space-y-5 border-b pb-6'>
        <Skeleton className='h-6 w-24' />
        <div className='space-y-4'>
          <div className='flex items-center justify-between gap-4'>
            <Skeleton className='h-5 w-20' />
            <Skeleton className='h-9 w-24' />
          </div>
          <Separator />
          <div className='flex items-center justify-between gap-4'>
            <Skeleton className='h-5 w-24' />
            <Skeleton className='h-5 w-20' />
          </div>
          <div className='space-y-3'>
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className='space-y-1 not-first:border-t not-first:pt-3'
              >
                <Skeleton className='h-5 w-28' />
                <Skeleton className='h-4 w-40' />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className='space-y-5 border-b pb-6'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1'>
            <Skeleton className='h-6 w-24' />
            <Skeleton className='h-5 w-56 max-w-full' />
          </div>
          <Skeleton className='h-8 w-24' />
        </div>
        <div className='space-y-4'>
          <div className='flex items-center justify-between gap-3'>
            <Skeleton className='h-5 w-16' />
            <Skeleton className='h-5 w-32' />
          </div>
          <Skeleton className='h-2 w-full rounded-full' />
          <Skeleton className='h-5 w-40' />
        </div>
      </div>
      <div className='flex items-center justify-between gap-4 border-b pb-6'>
        <div className='space-y-1'>
          <Skeleton className='h-6 w-24' />
          <Skeleton className='h-5 w-40' />
        </div>
        <Skeleton className='size-9' />
      </div>
    </PageLayout>
  )
}
