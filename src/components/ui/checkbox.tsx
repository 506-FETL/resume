'use client'

import * as React from 'react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { CheckIcon, MinusIcon } from 'lucide-react'

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot='checkbox'
      className={cn(
        'peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input shadow-xs transition-[background-color,border-color,box-shadow,color,opacity] duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease) outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot='checkbox-indicator'
        forceMount
        className='relative grid size-3.5 place-content-center text-current opacity-100 transition-opacity duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease) data-[state=unchecked]:opacity-0 [&>svg]:col-start-1 [&>svg]:row-start-1 [&>svg]:size-3.5'
      >
        <CheckIcon className='transition-opacity duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease) in-data-[state=indeterminate]:opacity-0' />
        <MinusIcon className='opacity-0 transition-opacity duration-(--ui-motion-fast) ease-(--ui-motion-enter-ease) in-data-[state=indeterminate]:opacity-100' />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
