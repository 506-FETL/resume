import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export function PreferencesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>偏好设置</CardTitle>
        <CardDescription>自定义你的使用体验</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <Label>主题设置</Label>
            <p className="text-muted-foreground text-sm">切换明暗主题</p>
          </div>
          <AnimatedThemeToggler />
        </div>
      </CardContent>
    </Card>
  )
}
