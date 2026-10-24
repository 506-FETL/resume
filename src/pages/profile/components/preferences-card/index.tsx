import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Card, CardContent } from '@/components/ui/card'

export function PreferencesCard() {
  return (
    <Card className='shadow-none'>
      <CardContent className='flex items-center justify-between gap-4'>
        <div className='space-y-1'>
          <h2 className='text-base font-semibold'>外观偏好</h2>
          <p className='text-sm text-muted-foreground'>切换浅色与深色主题。</p>
        </div>
        <AnimatedThemeToggler />
      </CardContent>
    </Card>
  )
}
