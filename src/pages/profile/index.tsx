import { Navigate } from 'react-router-dom'
import { PageHeader, PageLayout } from '@/components/layout/page-layout'
import { AnimatedContent } from '@/components/motion/animated-content'
import { QuotaCard } from '@/components/quota/quota-card'
import { ProfilePageSkeleton } from '@/components/page-skeletons/profile'
import useUserStore from '@/store/user'
import { AccountSettingsCard } from './components/account-settings-card'
import { PreferencesCard } from './components/preferences-card'
import { ProfileInfoCard } from './components/profile-info-card'

export default function ProfilePage() {
  const user = useUserStore((state) => state.currentUser)
  const authStatus = useUserStore((state) => state.authStatus)

  if (authStatus === 'anonymous') return <Navigate to='/login' replace />

  return (
    <AnimatedContent animationKey={!user ? 'loading' : 'ready'}>
      {!user ? (
        <ProfilePageSkeleton />
      ) : (
        <PageLayout key={user.id} width='narrow'>
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
