import { Lightbulb } from 'lucide-react'
import { Marquee } from '@/components/ui/marquee'

export default function ProTips() {
  const tips = [
    '大多数 ATS 系统无法正确解析复杂的图形或双栏布局',
    '建议保持简单的层级结构，使用标准字体（如 Arial, Calibri）',
    '确保内容能被准确抓取，避免使用图片代替文字',
    '使用常见的章节标题，如"工作经历"、"教育背景"',
    '避免使用页眉页脚放置重要信息',
    '保存为 PDF 格式以确保格式一致性',
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
