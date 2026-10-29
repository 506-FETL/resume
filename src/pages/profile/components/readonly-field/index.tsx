import type { ReactNode } from 'react'

interface ReadonlyFieldProps {
  id: string
  label: string
  icon: ReactNode
  value: string
}

export function ReadonlyField({ id, label, icon, value }: ReadonlyFieldProps) {
  return (
    <dl className='grid gap-2 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center'>
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
