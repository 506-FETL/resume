import { LayoutTemplate, Maximize2, RefreshCcw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AdvancedTools() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">高级工具箱</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:gap-3">
        <Button variant="outline" className="h-auto py-3 sm:py-4 flex flex-col gap-1.5 sm:gap-2 items-center text-center">
          <LayoutTemplate className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] sm:text-xs">职位描述比对</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 sm:py-4 flex flex-col gap-1.5 sm:gap-2 items-center text-center">
          <RefreshCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] sm:text-xs">一键格式化</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 sm:py-4 flex flex-col gap-1.5 sm:gap-2 items-center text-center">
          <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] sm:text-xs">ATS 预览</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 sm:py-4 flex flex-col gap-1.5 sm:gap-2 items-center text-center">
          <Settings2 className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] sm:text-xs">行业基准对比</span>
        </Button>
      </CardContent>
    </Card>
  )
}
