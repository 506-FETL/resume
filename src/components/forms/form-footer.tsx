import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface FormFooterProps {
  /** Whether the form has unsaved changes. Disables both buttons when false. */
  isDirty: boolean
  /** Whether a save is in flight. Disables both buttons when true. */
  saving?: boolean
  onSave: () => void
  onCancel: () => void
  saveLabel?: string
  cancelLabel?: string
  /** Hide the footer entirely (e.g. when viewing read-only/history snapshots). */
  hidden?: boolean
  size?: 'sm' | 'default'
  className?: string
}

/**
 * Standard form footer with Cancel / Save buttons.
 *
 * Buttons are always rendered (when `hidden` is false) but disabled when there
 * are no changes — matches the convention agreed for stage-detail and resume forms.
 */
export function FormFooter({
  isDirty,
  saving = false,
  onSave,
  onCancel,
  saveLabel = '保存修改',
  cancelLabel = '取消',
  hidden = false,
  size = 'sm',
  className,
}: FormFooterProps) {
  if (hidden) return null

  const disabled = saving || !isDirty

  return (
    <div className={cn('flex justify-end gap-2 border-t pt-3', className)}>
      <Button
        variant='ghost'
        size={size}
        onClick={onCancel}
        disabled={disabled}
      >
        {cancelLabel}
      </Button>
      <Button size={size} onClick={onSave} disabled={disabled}>
        {saveLabel}
      </Button>
    </div>
  )
}
