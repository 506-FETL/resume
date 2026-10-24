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
          {/* 页面标题 */}
          <PageHeader
            title='个人信息'
            description='管理个人资料、账户安全与使用偏好。'
          />

          {/* 个人资料卡片 */}
          <ProfileInfoCard user={user} />

          {/* 账户设置卡片 */}
          <AccountSettingsCard user={user} />

          {/* AI 额度卡片 */}
          <QuotaCard />

          {/* 偏好设置卡片 */}
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
      <div className='flex flex-col gap-6 rounded-xl border bg-card p-6'>
        <Skeleton className='h-6 w-24' />
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6'>
          <Skeleton className='size-24 shrink-0 rounded-full' />
          <div className='min-w-0 flex-1 space-y-3'>
            <Skeleton className='h-7 w-36' />
            <Skeleton className='h-5 w-full max-w-56' />
            <Skeleton className='h-5 w-24' />
          </div>
        </div>
        <Separator />
        <div className='grid gap-4 sm:grid-cols-2'>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className='space-y-2'>
              <Skeleton className='h-5 w-20' />
              <Skeleton className='h-9 w-full' />
            </div>
          ))}
        </div>
      </div>
      <div className='space-y-5 rounded-xl border p-6'>
        <Skeleton className='h-6 w-24' />
        <Skeleton className='h-9 w-full' />
        <Separator />
        <Skeleton className='h-14 w-full' />
      </div>
      <div className='space-y-4 rounded-xl border p-6'>
        <Skeleton className='h-6 w-24' />
        <Skeleton className='h-14 w-full' />
      </div>
      <div className='flex items-center justify-between rounded-xl border p-6'>
        <Skeleton className='h-10 w-40' />
        <Skeleton className='size-9' />
      </div>
    </PageLayout>
  )
}
