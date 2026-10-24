'use client'

import { User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  useCurrentUserImage,
  useCurrentUserName,
} from '@/hooks/use-current-user'

export function CurrentUserAvatar({ className }: { className?: string }) {
  const profileImage = useCurrentUserImage()
  const name = useCurrentUserName()

  return (
    <Avatar className={className}>
      <AvatarImage src={profileImage} alt={name || 'User'} />
      <AvatarFallback className='bg-muted'>
        <User className='size-4' />
      </AvatarFallback>
    </Avatar>
  )
}
