import { Space } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { SpacingSettingsProps } from './fields'
import { useSpacingSettings } from './use-spacing-settings'

export function SpacingSettings({ isMobile, disabled }: SpacingSettingsProps) {
  const {
    spacing,
    updateSpacing,
    open,
    fineMode,
    draft,
    pendingExit,
    setPendingExit,
    fieldStates,
    allFieldsValid,
    requestExit,
    handleOpenChange,
    handleFineModeChange,
    handleDraftChange,
    handleConfirm,
    handleMenuKeyDown,
    handleProtectedDismiss,
    handleDiscardChanges,
  } = useSpacingSettings()

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label='间距设置'
            variant='outline'
            size={isMobile ? 'icon' : 'sm'}
            className={cn(isMobile && 'size-9')}
            disabled={disabled}
          >
            <Space data-icon='inline-start' />
            {!isMobile && <span>间距</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          role='dialog'
          aria-labelledby='spacing-settings-title'
          className={cn(
            'w-80 max-w-[calc(100vw-2rem)]',
            isMobile && 'w-[calc(100vw-10rem)]',
          )}
          side={isMobile ? 'bottom' : 'right'}
          align={isMobile ? 'end' : 'start'}
          onKeyDown={handleMenuKeyDown}
          onInteractOutside={handleProtectedDismiss}
          onEscapeKeyDown={handleProtectedDismiss}
        >
          <DropdownMenuLabel
            id='spacing-settings-title'
            className='flex items-center justify-between gap-4 text-base md:text-sm'
          >
            <span>间距设置</span>
            <div className='flex items-center gap-2'>
              <Label
                htmlFor='fine-spacing-control'
                className='text-xs font-normal text-muted-foreground'
              >
                精细控制
              </Label>
              <Switch
                id='fine-spacing-control'
                checked={fineMode}
                disabled={disabled}
                onCheckedChange={handleFineModeChange}
              />
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {fineMode ? (
            <div className='flex flex-col gap-4 p-3 md:p-4'>
              {fieldStates.map(({ field, validation }) => {
                const inputId = `fine-spacing-${field.key}`
                const errorId = `${inputId}-error`

                return (
                  <div key={field.key} className='flex flex-col gap-2'>
                    <Label htmlFor={inputId} className='text-sm font-medium'>
                      {field.label}
                    </Label>
                    <div className='relative'>
                      <Input
                        id={inputId}
                        type='text'
                        inputMode='decimal'
                        value={draft[field.key]}
                        disabled={disabled}
                        aria-invalid={validation.error !== null}
                        aria-describedby={
                          validation.error ? errorId : undefined
                        }
                        className='pr-12'
                        onChange={(event) =>
                          handleDraftChange(field, event.target.value)
                        }
                      />
                      <span className='pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground'>
                        {field.suffix}
                      </span>
                    </div>
                    {validation.error && (
                      <p id={errorId} className='text-xs text-destructive'>
                        {validation.error}
                      </p>
                    )}
                  </div>
                )
              })}

              <div className='flex justify-end gap-2 pt-1'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => requestExit('close')}
                >
                  取消
                </Button>
                <Button
                  type='button'
                  size='sm'
                  disabled={disabled || !allFieldsValid}
                  onClick={handleConfirm}
                >
                  确认
                </Button>
              </div>
            </div>
          ) : (
            <div className='flex flex-col gap-4 p-3 md:gap-6 md:p-4'>
              {/* 模块上下间距 */}
              <div className='flex flex-col gap-2'>
                <div className='flex items-center justify-between'>
                  <Label className='text-sm font-medium'>模块上下间距</Label>
                  <span className='text-sm font-semibold text-muted-foreground'>
                    {spacing.sectionSpacing}
                    px
                  </span>
                </div>
                <Slider
                  value={[spacing.sectionSpacing]}
                  onValueChange={([value]) =>
                    updateSpacing({ sectionSpacing: value })
                  }
                  disabled={disabled}
                  min={0}
                  max={100}
                  step={1}
                  className='w-full'
                />
              </div>

              {/* 行间距 */}
              <div className='flex flex-col gap-2'>
                <div className='flex items-center justify-between'>
                  <Label className='text-sm font-medium'>行间距</Label>
                  <span className='text-sm font-semibold text-muted-foreground'>
                    {spacing.lineHeight.toFixed(1)}
                  </span>
                </div>
                <Slider
                  value={[spacing.lineHeight * 10]}
                  onValueChange={([value]) =>
                    updateSpacing({ lineHeight: value / 10 })
                  }
                  disabled={disabled}
                  min={10}
                  max={30}
                  step={1}
                  className='w-full'
                />
              </div>

              {/* 页面边距 */}
              <div className='flex flex-col gap-2'>
                <div className='flex items-center justify-between'>
                  <Label className='text-sm font-medium'>页面边距</Label>
                  <span className='text-sm font-semibold text-muted-foreground'>
                    {spacing.pageMargin}
                    px
                  </span>
                </div>
                <Slider
                  value={[spacing.pageMargin]}
                  onValueChange={([value]) =>
                    updateSpacing({ pageMargin: value })
                  }
                  disabled={disabled}
                  min={0}
                  max={100}
                  step={1}
                  className='w-full'
                />
              </div>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pendingExit !== null}
        onOpenChange={(nextOpen) => !nextOpen && setPendingExit(null)}
      >
        <AlertDialogContent size='sm'>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未保存的间距修改？</AlertDialogTitle>
            <AlertDialogDescription>
              当前精细间距尚未确认，放弃后页面将恢复为上次保存的设置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              onClick={handleDiscardChanges}
            >
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
