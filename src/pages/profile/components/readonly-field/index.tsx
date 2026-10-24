import type { ReactNode } from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

interface ReadonlyFieldProps {
  id: string
  label: string
  icon: ReactNode
  value: string
}

export function ReadonlyField({ id, label, icon, value }: ReadonlyFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className='items-center'>
        {icon}
        {label}
      </FieldLabel>
      <Input id={id} value={value} disabled className='bg-muted' />
    </Field>
  )
}
