import type { User } from '@supabase/supabase-js'
import { Calendar as CalendarIcon, Mail, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useCurrentUserName } from '@/hooks/use-current-user'
import supabase from '@/lib/supabase/client'
import { ProfileAvatar } from '../profile-avatar'
import { ReadonlyField } from '../readonly-field'
import { EmailRow } from './email-row'
import { NameRow } from './name-row'

interface ProfileInfoCardProps {
  user: User
}

function formatRegistrationDate(dateString?: string) {
  if (!dateString)
    return '未知'
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function ProfileInfoCard({ user: initialUser }: ProfileInfoCardProps) {
  const currentName = useCurrentUserName()
  const [user, setUser] = useState(initialUser)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED' && session?.user) {
        setUser(session.user)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fullName = user.user_metadata.full_name || ''
  const email = user.email || ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>个人资料</CardTitle>
        <CardDescription>你的基本账户信息</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center gap-6">
          <ProfileAvatar />
          <div className="flex flex-col gap-1">
            <h3 className="text-2xl font-semibold">{currentName}</h3>
            <p className="text-muted-foreground flex items-center gap-2">
              <Mail className="size-4 shrink-0" />
              {email}
            </p>
            <Badge variant={user.email_confirmed_at ? 'outline' : 'destructive'} className="mt-2 gap-1">
              <Shield className="size-3 shrink-0" />
              {user.email_confirmed_at ? '邮箱已验证' : '邮箱未验证'}
            </Badge>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <NameRow initialFullName={fullName} />
          <EmailRow initialEmail={email} />

          <ReadonlyField
            id="created"
            label="注册时间"
            icon={<CalendarIcon className="size-4 shrink-0" />}
            value={formatRegistrationDate(user.created_at)}
          />

          <ReadonlyField
            id="updated"
            label="最后更新"
            icon={<CalendarIcon className="size-4 shrink-0" />}
            value={formatRegistrationDate(user.updated_at || user.created_at)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
