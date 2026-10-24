import { LayoutTemplate, Palette, Undo2 } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { themeOptions } from '@/lib/schema'
import { cn } from '@/lib/utils'
import useResumeConfigStore from '@/store/resume/config'
import useResumeStore from '@/store/resume/form'
import { useTemplateCatalogEntry } from '../../../hooks/use-template-catalog-entry'
import { useTemplateSwitchSession } from '../../../hooks/use-template-switch-session'
import { useTemplateSwitchStore } from '../../../template-switch/store'
import TemplateSwitchDialog from '../../template-switch-dialog'

export default function TemplateSettings({
  isMobile,
  disabled,
}: {
  isMobile: boolean
  disabled: boolean
}) {
  const reducedMotion = useReducedMotion()
  const theme = useResumeConfigStore((state) => state.theme)
  const updateTheme = useResumeConfigStore((state) => state.updateTheme)
  const binding = useResumeStore((state) => state.templateBinding)
  const current = useTemplateCatalogEntry(binding?.templateId)
  const undoRecord = useTemplateSwitchStore((state) => state.undoRecord)
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useTemplateSwitchSession()

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            aria-label='模版设置'
            variant='outline'
            size={isMobile ? 'icon' : 'sm'}
            className={cn(isMobile && 'size-9')}
            disabled={disabled}
          >
            <Palette data-icon='inline-start' />
            {!isMobile && <span>模版</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className={cn(
            'w-80 max-w-[calc(100vw-2rem)]',
            reducedMotion && 'animate-none! duration-0!',
          )}
          side={isMobile ? 'bottom' : 'right'}
          align={isMobile ? 'end' : 'start'}
          onCloseAutoFocus={(event) => {
            if (useTemplateSwitchStore.getState().open) event.preventDefault()
          }}
        >
          <DropdownMenuLabel className='text-base md:text-sm'>
            模版设置
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className='flex flex-col gap-2 p-3 md:p-4'>
            <Label className='text-sm font-medium'>选择主题</Label>
            <Select
              value={theme.theme}
              disabled={disabled}
              onValueChange={(value) =>
                updateTheme({ theme: value as typeof theme.theme })
              }
            >
              <SelectTrigger className='h-10'>
                <SelectValue placeholder='选择主题' />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {themeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <DropdownMenuSeparator />
          <div className='flex flex-col gap-3 p-3 md:p-4'>
            <div>
              <p className='text-sm font-medium'>更换模板</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                当前使用：
                {current.item?.name ?? '当前模板'}
              </p>
            </div>
            <DropdownMenuItem
              asChild
              disabled={disabled}
              onSelect={() => {
                setMenuOpen(false)
                useTemplateSwitchStore.getState().openDialog()
              }}
            >
              <Button variant='outline' disabled={disabled}>
                <LayoutTemplate className='size-4' />
                选择模板
              </Button>
            </DropdownMenuItem>
            {undoRecord && (
              <DropdownMenuItem
                asChild
                disabled={disabled}
                onSelect={() => {
                  if (
                    useTemplateSwitchStore
                      .getState()
                      .undoTemplate(undoRecord.operationId)
                  )
                    toast.success('已撤销模板更换')
                  else toast.info('简历状态已变化，无法撤销这次更换')
                }}
              >
                <Button variant='ghost' size='sm' disabled={disabled}>
                  <Undo2 className='size-3.5' />
                  撤销上次更换
                </Button>
              </DropdownMenuItem>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <TemplateSwitchDialog triggerRef={triggerRef} />
    </>
  )
}
