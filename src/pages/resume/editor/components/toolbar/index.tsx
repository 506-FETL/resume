import { FileDown, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { themeOptions } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useResumeConfigStore from '@/store/resume/config'
import useResumeStore from '@/store/resume/form'
import ExportDialog from '../export'
import { FontSettings } from './font-settings'
import { ResumeHistoryVersionDropdown } from './history-version-dropdown'
import { SpacingSettings } from './spacing-settings'
import { VariantLineageButton } from './variant-lineage-button'

export default function ResumeConfigToolbar() {
  const isMobile = useIsMobile()
  const { theme, updateTheme } = useResumeConfigStore()
  const isToolbarLoading = useResumeStore(state => !state.isInitialized)

  return (
    <div className={cn('flex flex-row gap-2')}>

      <SpacingSettings isMobile={isMobile} disabled={isToolbarLoading} />

      <FontSettings isMobile={isMobile} disabled={isToolbarLoading} />

      {/* 皮肤设置 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={isMobile ? 'icon' : 'sm'}
            className={cn(isMobile && 'size-9')}
            disabled={isToolbarLoading}
          >
            <Palette data-icon="inline-start" />
            {!isMobile && <span>皮肤</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className={cn('w-80 max-w-[calc(100vw-2rem)]', isMobile && 'w-[calc(100vw-10rem)]')}
          side={isMobile ? 'bottom' : 'right'}
          align={isMobile ? 'end' : 'start'}
        >
          <DropdownMenuLabel className="text-base md:text-sm">皮肤设置</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="flex flex-col gap-2 p-3 md:p-4">
            <Label className="text-sm font-medium">选择主题</Label>
            <Select
              value={theme.theme}
              disabled={isToolbarLoading}
              onValueChange={value =>
                updateTheme({
                  theme: value as typeof theme.theme,
                })}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择主题" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {themeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResumeHistoryVersionDropdown />

      <VariantLineageButton />

      <ExportDialog
        trigger={(
          <Button variant="outline" size={isMobile ? 'icon' : 'sm'} disabled={isToolbarLoading}>
            <FileDown data-icon="inline-start" />
            {!isMobile && <span>导出</span>}
          </Button>
        )}
      />
    </div>
  )
}
