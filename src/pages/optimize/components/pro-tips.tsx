import { Lightbulb } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function ProTips() {
  return (
    <Card className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/50 shadow-sm">
      <CardContent className="p-4 flex gap-3">
        <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30 shrink-0 h-fit">
          <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-1 pt-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">专业提示</p>
          <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed">
            大多数 ATS 系统无法正确解析复杂的图形或双栏布局。建议保持简单的层级结构，使用标准的字体（如 Arial, Calibri），以确保内容能被准确抓取。
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
