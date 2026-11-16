import * as React from 'react'

// --- Lib ---
import { cn } from '@/lib/tiptap-utils'
import '@/components/tiptap-ui-primitive/button/button-colors.scss'
import '@/components/tiptap-ui-primitive/button/button-group.scss'
import '@/components/tiptap-ui-primitive/button/button.scss'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string
}

export function Button({
  ref,
  className,
  children,
  'aria-label': ariaLabel,
  ...props
}: ButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> }) {
  return (
    <button
      className={cn('tiptap-button', className)}
      ref={ref}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  )
}

Button.displayName = 'Button'

export function ButtonGroup({
  ref,
  className,
  children,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical'
} & { ref?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={ref}
      className={cn('tiptap-button-group', className)}
      data-orientation={orientation}
      role='group'
      {...props}
    >
      {children}
    </div>
  )
}

ButtonGroup.displayName = 'ButtonGroup'

export default Button
