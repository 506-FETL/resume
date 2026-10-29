import type { ReactNode } from 'react'
import { useRef } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

interface EditableFieldProps {
  id: string
  label: string
  icon: ReactNode
  value: string
  type?: string
  isEditing: boolean
  isSaving: boolean
  onValueChange: (value: string) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export function EditableField({
  id,
  label,
  icon,
  value,
  type = 'text',
  isEditing,
  isSaving,
  onValueChange,
  onEdit,
  onSave,
  onCancel,
}: EditableFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const moveFocus = (action: () => void) => {
    inputRef.current?.focus({ preventScroll: true })
    action()
  }

  return (
    <Field>
      <FieldLabel htmlFor={id} className='items-center'>
        {icon}
        {label}
      </FieldLabel>
      <div className='flex gap-2'>
        <Input
          ref={inputRef}
          id={id}
          type={type}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          readOnly={!isEditing || isSaving}
          aria-busy={isSaving}
          className={
            !isEditing
              ? 'bg-muted transition-colors motion-reduce:transition-none'
              : 'transition-colors motion-reduce:transition-none'
          }
        />
        <AnimatedContent
          animationKey={isEditing ? 'editing' : 'idle'}
          className='flex shrink-0 gap-2'
        >
          {!isEditing ? (
            <Button
              variant='outline'
              size='icon'
              onClick={() => moveFocus(onEdit)}
              aria-label={`编辑${label}`}
            >
              <Pencil />
            </Button>
          ) : (
            <>
              <Button
                variant='outline'
                size='icon'
                onClick={() => moveFocus(onSave)}
                disabled={isSaving}
                aria-label={`保存${label}`}
              >
                <AnimatedContent
                  as='span'
                  animationKey={isSaving ? 'saving' : 'idle'}
                  className='flex items-center'
                >
                  {isSaving ? <Spinner /> : <Check />}
                </AnimatedContent>
              </Button>
              <Button
                variant='outline'
                size='icon'
                onClick={() => moveFocus(onCancel)}
                disabled={isSaving}
                aria-label={`取消编辑${label}`}
              >
                <X />
              </Button>
            </>
          )}
        </AnimatedContent>
      </div>
    </Field>
  )
}
