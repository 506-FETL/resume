import { Clock, Key, MapPin, Monitor, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

interface SessionInfoProps {
  lastSignInAt?: string
  provider?: string
  formatDate: (dateString: string) => string
}

export function SessionInfo({ lastSignInAt, provider, formatDate }: SessionInfoProps) {
  const getDeviceInfo = () => {
    if (typeof navigator === 'undefined')
      return '浏览器'

    const ua = navigator.userAgent
    const os = ua.includes('Mac')
      ? 'macOS'
      : ua.includes('Windows')
        ? 'Windows'
        : ua.includes('Linux')
          ? 'Linux'
          : '未知系统'
    const browser = ua.includes('Chrome')
      ? 'Chrome'
      : ua.includes('Firefox')
        ? 'Firefox'
        : ua.includes('Safari')
          ? 'Safari'
          : '其他浏览器'

    return `${os} · ${browser}`
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <Label className="flex items-center gap-2">
            <Key className="size-4 shrink-0" />
            会话信息
          </Label>
          <p className="text-muted-foreground text-sm">当前登录会话的详细信息</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Monitor className="size-3 shrink-0" />
          当前设备
        </Badge>
      </div>

      <div className="bg-muted/50 flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground size-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">最后登录时间</p>
              <p className="text-muted-foreground text-xs">{lastSignInAt ? formatDate(lastSignInAt) : '未知'}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-muted-foreground size-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">登录方式</p>
              <p className="text-muted-foreground text-xs">{provider === 'email' ? '邮箱密码' : provider}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="text-muted-foreground size-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">设备信息</p>
              <p className="text-muted-foreground text-xs">{getDeviceInfo()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
