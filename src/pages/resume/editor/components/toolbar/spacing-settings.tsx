import type { KeyboardEvent } from 'react'
import type { ResumeAppearanceConfig } from '@/lib/schema'
import { Space } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import useResumeConfigStore from '@/store/resume/config'

const FINE_SPACING_FIELDS = [
  {
    key: 'sectionSpacing',
    label: '模块上下间距',
    min: 0,
    max: 100,
    decimals: 1,
    suffix: 'px',
  },
  {
    key: 'lineHeight',
    label: '行间距',
    min: 1,
    max: 3,
    decimals: 2,
    suffix: '倍',
  },
  {
    key: 'pageMargin',
    label: '页面边距',
    min: 0,
    max: 100,
    decimals: 1,
    suffix: 'px',
  },
] as const

type Spacing = ResumeAppearanceConfig['spacing']
type FineSpacingKey = typeof FINE_SPACING_FIELDS[number]['key']
type FineSpacingField = typeof FINE_SPACING_FIELDS[number]
type FineSpacingDraft = Record<FineSpacingKey, string>
type PendingExit = 'close' | 'coarse'

interface SpacingSettingsProps {
  isMobile: boolean
  disabled: boolean
}

interface ValidationResult {
  value: number | null
  error: string | null
}

function createDraft(spacing: Spacing): FineSpacingDraft {
  return {
    sectionSpacing: String(spacing.sectionSpacing),
    lineHeight: String(spacing.lineHeight),
    pageMargin: String(spacing.pageMargin),
  }
}

function validateDraftValue(field: FineSpacingField, rawValue: string): ValidationResult {
  const value = rawValue.trim()

  if (!value) {
    return { value: null, error: '请输入数值' }
  }

  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
    return { value: null, error: '请输入有效的十进制数字' }
  }

  const fractionDigits = value.split('.')[1]?.length ?? 0
  if (fractionDigits > field.decimals) {
    return { value: null, error: `最多保留 ${field.decimals} 位小数` }
  }

  const parsed = Number(value)
  if (parsed < field.min || parsed > field.max) {
    return { value: null, error: `请输入 ${field.min}–${field.max} 之间的数值` }
  }

  return { value: parsed, error: null }
}

export function SpacingSettings({ isMobile, disabled }: SpacingSettingsProps) {
  const {
    spacing,
    updateSpacing,
    beginSpacingPreview,
    updateSpacingPreview,
    commitSpacingPreview,
    discardSpacingPreview,
  } = useResumeConfigStore()
  const [open, setOpen] = useState(false)
  const [fineMode, setFineMode] = useState(false)
  const [draft, setDraft] = useState<FineSpacingDraft>(() => createDraft(spacing))
  const [baseline, setBaseline] = useState<Spacing | null>(null)
  const [pendingExit, setPendingExit] = useState<PendingExit | null>(null)
  const fineSessionActiveRef = useRef(false)

  const fieldStates = useMemo(() => FINE_SPACING_FIELDS.map(field => ({
    field,
    validation: validateDraftValue(field, draft[field.key]),
  })), [draft])
  const allFieldsValid = fieldStates.every(({ validation }) => validation.error === null)
  const isDirty = baseline !== null && fieldStates.some(({ field, validation }) => {
    if (validation.value !== null) {
      return validation.value !== baseline[field.key]
    }

    return draft[field.key] !== createDraft(baseline)[field.key]
  })

  useEffect(() => () => {
    if (fineSessionActiveRef.current) {
      discardSpacingPreview()
    }
  }, [discardSpacingPreview])

  function startFineSession() {
    const nextBaseline = { ...spacing }
    setBaseline(nextBaseline)
    setDraft(createDraft(nextBaseline))
    beginSpacingPreview()
    fineSessionActiveRef.current = true
  }

  function finishExit(action: PendingExit) {
    if (fineSessionActiveRef.current) {
      discardSpacingPreview()
      fineSessionActiveRef.current = false
    }
    setBaseline(null)
    setPendingExit(null)

    if (action === 'close') {
      setOpen(false)
      return
    }

    setFineMode(false)
  }

  function requestExit(action: PendingExit) {
    if (fineMode && isDirty) {
      setPendingExit(action)
      return
    }

    finishExit(action)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true)
      if (fineMode) {
        startFineSession()
      }
      return
    }

    requestExit('close')
  }

  function handleFineModeChange(nextFineMode: boolean) {
    if (nextFineMode) {
      setFineMode(true)
      startFineSession()
      return
    }

    requestExit('coarse')
  }

  function handleDraftChange(field: FineSpacingField, value: string) {
    setDraft(current => ({ ...current, [field.key]: value }))

    const validation = validateDraftValue(field, value)
    if (validation.value !== null) {
      updateSpacingPreview({ [field.key]: validation.value })
    }
  }

  function handleConfirm() {
    if (!allFieldsValid) {
      return
    }

    if (isDirty) {
      commitSpacingPreview()
    }
    else {
      discardSpacingPreview()
    }

    fineSessionActiveRef.current = false
    setBaseline(null)
    setOpen(false)
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') {
      return
    }

    const focusableElements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ))
    if (focusableElements.length === 0) {
      return
    }

    event.preventDefault()
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1)
      : (currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1)
    focusableElements[nextIndex]?.focus()
  }

  function handleProtectedDismiss(event: Event) {
    if (!fineMode || !isDirty) {
      return
    }

    event.preventDefault()
    if (pendingExit === null) {
      setPendingExit('close')
    }
  }

  function handleDiscardChanges() {
    if (pendingExit !== null) {
      finishExit(pendingExit)
    }
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={isMobile ? 'icon' : 'sm'}
            className={cn(isMobile && 'size-9')}
            disabled={disabled}
          >
            <Space data-icon="inline-start" />
            {!isMobile && <span>间距</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          role="dialog"
          aria-labelledby="spacing-settings-title"
          className={cn('w-80 max-w-[calc(100vw-2rem)]', isMobile && 'w-[calc(100vw-10rem)]')}
          side={isMobile ? 'bottom' : 'right'}
          align={isMobile ? 'end' : 'start'}
          onKeyDown={handleMenuKeyDown}
          onInteractOutside={handleProtectedDismiss}
          onEscapeKeyDown={handleProtectedDismiss}
        >
          <DropdownMenuLabel id="spacing-settings-title" className="flex items-center justify-between gap-4 text-base md:text-sm">
            <span>间距设置</span>
            <div className="flex items-center gap-2">
              <Label htmlFor="fine-spacing-control" className="text-xs font-normal text-muted-foreground">
                精细控制
              </Label>
              <Switch
                id="fine-spacing-control"
                checked={fineMode}
                disabled={disabled}
                onCheckedChange={handleFineModeChange}
              />
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {fineMode
            ? (
                <div className="flex flex-col gap-4 p-3 md:p-4">
                  {fieldStates.map(({ field, validation }) => {
                    const inputId = `fine-spacing-${field.key}`
                    const errorId = `${inputId}-error`

                    return (
                      <div key={field.key} className="flex flex-col gap-2">
                        <Label htmlFor={inputId} className="text-sm font-medium">{field.label}</Label>
                        <div className="relative">
                          <Input
                            id={inputId}
                            type="text"
                            inputMode="decimal"
                            value={draft[field.key]}
                            disabled={disabled}
                            aria-invalid={validation.error !== null}
                            aria-describedby={validation.error ? errorId : undefined}
                            className="pr-12"
                            onChange={event => handleDraftChange(field, event.target.value)}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                            {field.suffix}
                          </span>
                        </div>
                        {validation.error && (
                          <p id={errorId} className="text-xs text-destructive">{validation.error}</p>
                        )}
                      </div>
                    )
                  })}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => requestExit('close')}>
                      取消
                    </Button>
                    <Button type="button" size="sm" disabled={disabled || !allFieldsValid} onClick={handleConfirm}>
                      确认
                    </Button>
                  </div>
                </div>
              )
            : (
                <div className="flex flex-col gap-4 p-3 md:gap-6 md:p-4">
                  {/* 模块上下间距 */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">模块上下间距</Label>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {spacing.sectionSpacing}
                        px
                      </span>
                    </div>
                    <Slider
                      value={[spacing.sectionSpacing]}
                      onValueChange={([value]) => updateSpacing({ sectionSpacing: value })}
                      disabled={disabled}
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* 行间距 */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">行间距</Label>
                      <span className="text-sm font-semibold text-muted-foreground">{spacing.lineHeight.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[spacing.lineHeight * 10]}
                      onValueChange={([value]) => updateSpacing({ lineHeight: value / 10 })}
                      disabled={disabled}
                      min={10}
                      max={30}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* 页面边距 */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">页面边距</Label>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {spacing.pageMargin}
                        px
                      </span>
                    </div>
                    <Slider
                      value={[spacing.pageMargin]}
                      onValueChange={([value]) => updateSpacing({ pageMargin: value })}
                      disabled={disabled}
                      min={0}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pendingExit !== null}
        onOpenChange={nextOpen => !nextOpen && setPendingExit(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未保存的间距修改？</AlertDialogTitle>
            <AlertDialogDescription>
              当前精细间距尚未确认，放弃后页面将恢复为上次保存的设置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDiscardChanges}>放弃修改</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
