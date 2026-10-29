import { Maximize, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type ReadingZoom = 'fit' | 50 | 75 | 100

export function ReadingToolbar({
  zoom,
  onZoomChange,
}: {
  zoom: ReadingZoom
  onZoomChange: (zoom: ReadingZoom) => void
}) {
  return (
    <div
      role='group'
      aria-label='阅读缩放'
      className='flex shrink-0 items-center gap-1 rounded-lg bg-background p-1'
    >
      <Button
        size='sm'
        variant={zoom === 'fit' ? 'secondary' : 'ghost'}
        onClick={() => onZoomChange('fit')}
        aria-pressed={zoom === 'fit'}
      >
        <Maximize className='size-3.5' />
        适宽
      </Button>
      <ZoomIn
        className='ml-1 size-3.5 text-muted-foreground'
        aria-hidden='true'
      />
      <Select
        value={String(zoom)}
        onValueChange={(value) =>
          onZoomChange(value === 'fit' ? 'fit' : (Number(value) as ReadingZoom))
        }
      >
        <SelectTrigger
          size='sm'
          aria-label='文档显示比例'
          className='min-w-20 border-transparent bg-transparent text-xs shadow-none'
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='fit'>自动</SelectItem>
          <SelectItem value='50'>50%</SelectItem>
          <SelectItem value='75'>75%</SelectItem>
          <SelectItem value='100'>100%</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
