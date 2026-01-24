import { LayoutTemplate, Maximize2, RefreshCcw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdvancedTools() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">高级工具箱</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 items-center text-center hover:bg-muted/50 hover:border-primary/50 transition-all">
          <LayoutTemplate className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs font-medium">职位描述比对</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 items-center text-center hover:bg-muted/50 hover:border-primary/50 transition-all">
          <RefreshCcw className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs font-medium">一键格式化</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 items-center text-center hover:bg-muted/50 hover:border-primary/50 transition-all">
          <Maximize2 className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs font-medium">ATS 预览</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 items-center text-center hover:bg-muted/50 hover:border-primary/50 transition-all">
          <Settings2 className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs font-medium">行业基准对比</span>
        </Button>
      </CardContent>
    </Card>
  )
}
