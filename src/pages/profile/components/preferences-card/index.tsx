import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export function PreferencesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>偏好设置</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Label>主题设置</Label>
          <AnimatedThemeToggler />
        </div>
      </CardContent>
    </Card>
  )
}
