import type { ReactNode } from 'react'

interface ReadonlyFieldProps {
  id: string
  label: string
  icon: ReactNode
  value: string
}

export function ReadonlyField({ id, label, icon, value }: ReadonlyFieldProps) {
  return (
    <dl className='space-y-2'>
      <dt
        id={`${id}-label`}
        className='flex items-center gap-2 text-sm font-medium'
      >
        {icon}
        {label}
      </dt>
      <dd
        id={id}
        aria-labelledby={`${id}-label`}
        className='text-sm leading-6 text-muted-foreground break-words'
      >
        {value}
      </dd>
    </dl>
  )
}
