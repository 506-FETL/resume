import { Lightbulb } from 'lucide-react'
import { Marquee } from '@/components/ui/marquee'

export default function ProTips() {
  const tips = [
    '复杂图形或双栏布局可能影响 ATS 解析',
    '使用简洁的层级和常见字体',
    '避免用图片代替文字',
    '使用“工作经历”“教育背景”等常见章节标题',
    '重要信息不要放在页眉页脚',
    '导出 PDF 后，检查排版是否完整',
  ]

  return (
    <div className="w-full border-y border-amber-200/50 bg-amber-50/90 backdrop-blur-sm dark:border-amber-900/50 dark:bg-amber-950/80">
      <Marquee
        pauseOnHover
        className="py-1.5 [--gap:3rem]"
      >
        {tips.map(tip => (
          <div key={tip} className="flex items-center gap-2 shrink-0">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-800 dark:text-amber-200/90 whitespace-nowrap">
              {tip}
            </span>
          </div>
        ))}
      </Marquee>
    </div>
  )
}
