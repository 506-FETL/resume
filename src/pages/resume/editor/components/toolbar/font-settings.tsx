import { Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { fontFamilyOptions } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useResumeConfigStore from '@/store/resume/config'

interface FontSettingsProps {
  isMobile: boolean
  disabled: boolean
}

export function FontSettings({ isMobile, disabled }: FontSettingsProps) {
  const { font, updateFont } = useResumeConfigStore()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={isMobile ? 'icon' : 'sm'}
          className={cn(isMobile && 'size-9')}
          disabled={disabled}
        >
          <Type data-icon="inline-start" />
          {!isMobile && <span>字体</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn('w-80 max-w-[calc(100vw-2rem)]', isMobile && 'w-[calc(100vw-10rem)]')}
        side={isMobile ? 'bottom' : 'right'}
        align={isMobile ? 'end' : 'start'}
      >
        <DropdownMenuLabel className="text-base md:text-sm">字体设置</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="flex flex-col gap-4 p-3 md:p-4">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">字体样式</Label>
            <Select
              value={font.fontFamily}
              disabled={disabled}
              onValueChange={(value: typeof font.fontFamily) => updateFont({ fontFamily: value })}
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
              value={[font.fontSize]}
              min={10}
              max={24}
              step={1}
              disabled={disabled}
              onValueChange={([fontSize]) => updateFont({ fontSize })}
            />
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
