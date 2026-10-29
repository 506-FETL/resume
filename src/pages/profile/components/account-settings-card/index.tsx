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
    <Card className='gap-5 overflow-visible rounded-none border-0 border-b bg-transparent pt-0 pb-6 shadow-none ring-0'>
      <CardHeader className='px-0 pt-0'>
        <CardTitle>账户设置</CardTitle>
      </CardHeader>
      <CardContent className='px-0 flex flex-col gap-4'>
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
