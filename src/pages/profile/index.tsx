import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
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
      }
      catch (error: unknown) {
        toast.error(`用户信息加载失败：${getErrorMessage(error)}`)
        navigate('/login')
      }
      finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [navigate])

  if (!user || loading) {
    return <ProfilePageSkeleton />
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">个人信息</h1>
        <p className="text-muted-foreground mt-2">管理你的账户信息和偏好设置</p>
      </div>

      <Separator />

      {/* 个人资料卡片 */}
      <ProfileInfoCard user={user} />

      {/* 账户设置卡片 */}
      <AccountSettingsCard user={user} />

      {/* 偏好设置卡片 */}
      <PreferencesCard />
    </div>
  )
}

function ProfilePageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in-50 duration-500">
      {/* 页面标题骨架 */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-5 w-80" />
      </div>

      <Separator />

      {/* 个人资料卡片骨架 */}
      <div className="rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-6">
        <div className="flex items-start gap-6">
          {/* 头像骨架 */}
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="size-32 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>

          {/* 用户信息骨架 */}
          <div className="flex-1 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full max-w-md rounded-md" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full max-w-md rounded-md" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-48" />
            </div>
          </div>
        </div>
      </div>

      {/* 账户设置卡片骨架 */}
      <div className="rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Separator />
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 偏好设置卡片骨架 */}
      <div className="rounded-xl border bg-card shadow-sm p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-28 rounded-lg" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Separator />
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
          <Separator />
          <div className="flex items-center justify-between py-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
