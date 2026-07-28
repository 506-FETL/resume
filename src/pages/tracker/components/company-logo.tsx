import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface CompanyLogoProps {
  logo: string | null
  company: string
  icon: LucideIcon
  imgClassName?: string
  iconClassName?: string
}

/**
 * 公司 Logo：有 URL 且能正常加载时显示图片，否则（无 URL 或加载失败）回退到占位图标。
 * 集中处理 onError 兜底，避免各处 <img> 坏 URL 碎图。
 */
export function CompanyLogo({ logo, company, icon: Icon, imgClassName, iconClassName }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false)

  // 切换到新的 logo 地址时重置失败态
  useEffect(() => {
    setFailed(false)
  }, [logo])

  if (!logo || failed)
    return <Icon className={cn('size-4', iconClassName)} />

  return (
    <img
      src={logo}
      alt={company}
      className={cn('size-5 object-contain', imgClassName)}
      onError={() => setFailed(true)}
    />
  )
}
