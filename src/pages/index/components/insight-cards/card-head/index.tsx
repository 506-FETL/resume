import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReactNode } from 'react'

// 卡片头：图标 chip + 标题 + 描述（复用首页既有视觉语言）
export function CardHead({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <CardHeader className='px-0 pb-4'>
      <div className='flex items-center gap-2'>
        <div className='text-muted-foreground'>{icon}</div>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
      </div>
      <CardDescription className='text-xs'>{description}</CardDescription>
    </CardHeader>
  )
}
