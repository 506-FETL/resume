import type { User } from '@supabase/supabase-js'
import { Calendar as CalendarIcon, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import supabase from '@/lib/supabase/client'
import { ProfileAvatar } from '../profile-avatar'
import { ReadonlyField } from '../readonly-field'
import { EmailRow } from './email-row'
import { NameRow } from './name-row'

interface ProfileInfoCardProps {
  user: User
}

function formatRegistrationDate(dateString?: string) {
  if (!dateString) return '未知'

  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function ProfileInfoCard({ user: initialUser }: ProfileInfoCardProps) {
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
    <Card className='gap-5 overflow-visible rounded-none border-0 border-b bg-transparent pt-0 pb-6 shadow-none ring-0'>
      <CardHeader className='px-0 pt-0'>
        <CardTitle className='font-semibold'>个人资料</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-5 px-0'>
        <div className='flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6'>
          <ProfileAvatar />
          <div className='min-w-0'>
            <Badge
              variant={user.email_confirmed_at ? 'outline' : 'destructive'}
              className='gap-1'
            >
              <Shield className='size-3 shrink-0' />
              {user.email_confirmed_at ? '邮箱已验证' : '邮箱未验证'}
            </Badge>
          </div>
        </div>

        <div className='divide-y'>
          <NameRow initialFullName={fullName} />
          <EmailRow initialEmail={email} />

          <ReadonlyField
            id='created'
            label='注册时间'
            icon={<CalendarIcon className='size-4 shrink-0' />}
            value={formatRegistrationDate(user.created_at)}
          />

          <ReadonlyField
            id='updated'
            label='最后更新'
            icon={<CalendarIcon className='size-4 shrink-0' />}
            value={formatRegistrationDate(user.updated_at || user.created_at)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
