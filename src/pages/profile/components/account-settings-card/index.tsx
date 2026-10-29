import type { User } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { UpdatePasswordDialog } from '@/components/update-password-dialog'
import { formatRelativeTime } from '@/utils/date'
import { SessionInfo } from '../session-info'

interface AccountSettingsCardProps {
  user: User
}

export function AccountSettingsCard({ user }: AccountSettingsCardProps) {
  return (
    <Card className='shadow-none'>
      <CardHeader>
        <CardTitle>账户设置</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <div className='flex items-center justify-between'>
          <Label>修改密码</Label>
          <UpdatePasswordDialog />
        </div>
        <Separator />
        <SessionInfo
          lastSignInAt={user.last_sign_in_at}
          provider={user.app_metadata.provider}
          formatDate={(date) => formatRelativeTime(date, true)}
        />
      </CardContent>
    </Card>
  )
}
