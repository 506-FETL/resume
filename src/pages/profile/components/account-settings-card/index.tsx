import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { UpdatePasswordDialog } from '@/components/update-password-dialog'
import { getCurrentUser } from '@/lib/supabase/user'
import { formatRelativeTime } from '@/utils/date'
import { SessionInfo } from '../session-info'

interface AccountSettingsCardProps {
  user: User
}

export function AccountSettingsCard({ user }: AccountSettingsCardProps) {
  const [sessionInfo, setSessionInfo] = useState<{
    lastSignInAt?: string
    provider?: string
  } | null>(null)

  useEffect(() => {
    const fetchSessionInfo = async () => {
      try {
        const user = await getCurrentUser()

        if (!user) {
          toast.error('无法获取用户信息')
          return
        }

        setSessionInfo({
          lastSignInAt: user.last_sign_in_at || undefined,
          provider: user.app_metadata.provider || 'email',
        })
      }
      catch (error) {
        toast.error(`加载会话信息失败${error}`)
      }
    }

    fetchSessionInfo()
  }, [user])

  return (
    <Card>
      <CardHeader>
        <CardTitle>账户设置</CardTitle>
        <CardDescription>管理你的账户安全和偏好</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <Label>修改密码</Label>
            <p className="text-muted-foreground text-sm">更新你的账户密码以保护安全</p>
          </div>
          <UpdatePasswordDialog />
        </div>

        <Separator />

        {sessionInfo ? <SessionInfo {...sessionInfo} formatDate={d => formatRelativeTime(d, true)} /> : <LoadingSkeleton />}
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
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
  )
}
