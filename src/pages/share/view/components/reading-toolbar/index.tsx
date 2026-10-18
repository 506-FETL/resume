import { Maximize, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type ReadingZoom = 'fit' | 50 | 75 | 100

export function ReadingToolbar({ zoom, onZoomChange }: { zoom: ReadingZoom, onZoomChange: (zoom: ReadingZoom) => void }) {
  return (
    <div role="group" aria-label="阅读缩放" className="flex shrink-0 items-center gap-1 rounded-lg border bg-background p-1">
      <Button size="sm" variant={zoom === 'fit' ? 'secondary' : 'ghost'} onClick={() => onZoomChange('fit')} aria-pressed={zoom === 'fit'}>
        <Maximize className="size-3.5" />
        适宽
      </Button>
      <ZoomIn className="ml-1 size-3.5 text-muted-foreground" aria-hidden="true" />
      <select className="h-7 rounded-md bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="文档显示比例" value={zoom} onChange={event => onZoomChange(event.target.value === 'fit' ? 'fit' : Number(event.target.value) as ReadingZoom)}>
        <option value="fit">自动</option>
        <option value="50">50%</option>
        <option value="75">75%</option>
        <option value="100">100%</option>
      </select>
    </div>
  )
}
