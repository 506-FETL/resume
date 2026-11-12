import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { AnimatedContent } from '@/components/motion/animated-content'
import { QuotaCard } from '@/components/quota/quota-card'
import { ProfilePageSkeleton } from '@/components/page-skeletons/profile'
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
