import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>账户设置</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Label>修改密码</Label>
          <UpdatePasswordDialog />
        </div>

        <Separator />

        <AnimatedContent animationKey={sessionInfo ? 'ready' : 'loading'}>
          {sessionInfo ? <SessionInfo {...sessionInfo} formatDate={d => formatRelativeTime(d, true)} /> : <LoadingSkeleton />}
        </AnimatedContent>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-label="正在加载会话信息" aria-busy="true">
      {[0, 1].map(item => (
        <div key={item} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-full" />
        </div>
      ))}
    </div>
  )
}
