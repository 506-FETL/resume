import { Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { fontFamilyEnum, fontFamilyOptions } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useResumeConfigStore from '@/store/resume/config'

interface FontSettingsProps {
  isMobile: boolean
  disabled: boolean
}

export function FontSettings({ isMobile, disabled }: FontSettingsProps) {
  const { font, updateFont } = useResumeConfigStore()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={isMobile ? '字体设置' : undefined}
          variant="outline"
          size={isMobile ? 'icon' : 'sm'}
          className={cn(isMobile && 'size-9')}
          disabled={disabled}
        >
          <Type data-icon="inline-start" />
          {!isMobile && <span>字体</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="字体设置"
        className={cn('w-80 max-w-[calc(100vw-2rem)] p-0', isMobile && 'w-[calc(100vw-10rem)]')}
        side={isMobile ? 'bottom' : 'right'}
        align={isMobile ? 'end' : 'start'}
      >
        <div className="px-2 py-1.5 text-base font-medium md:text-sm">字体设置</div>
        <Separator />

        <div className="flex flex-col gap-4 p-3 md:p-4">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">字体样式</Label>
            <Select
              value={font.fontFamily}
              disabled={disabled}
              onValueChange={(value) => {
                const parsed = fontFamilyEnum.safeParse(value)
                if (parsed.success) {
                  updateFont({ fontFamily: parsed.data })
                }
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择字体" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {fontFamilyOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <Label className="text-sm font-medium">文字大小</Label>
              <span className="text-sm font-semibold text-muted-foreground">
                {font.fontSize}
                px
              </span>
            </div>
            <Slider
              aria-label="文字大小"
              aria-valuetext={`${font.fontSize}px`}
              value={[font.fontSize]}
              min={10}
              max={24}
              step={1}
              disabled={disabled}
              onValueChange={([fontSize]) => updateFont({ fontSize })}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
