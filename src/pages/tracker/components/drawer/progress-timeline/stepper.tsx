// Adapted from ReUI's Radix Stepper (MIT), Copyright (c) 2025 Keenthemes Inc.
// https://github.com/keenthemes/reui/blob/main/registry-reui/bases/radix/reui/stepper.tsx
// Full license: ./LICENSE.md. Business progress is explicit; this is not a tab widget.
import type { ComponentProps, KeyboardEvent } from 'react'
import { createContext, use } from 'react'
import { cn } from '@/lib/utils'

type StepState = 'active' | 'completed' | 'inactive' | 'ended'
const StepContext = createContext<StepState>('inactive')
const transition = 'transition-[color,background-color,border-color,box-shadow] duration-[var(--stepper-duration)] ease-[var(--stepper-ease)]'

export function Stepper({ className, ...props }: ComponentProps<'ol'>) {
  return <ol data-slot="stepper" className={cn('flex w-full', className)} {...props} />
}

export function StepperItem({ state, className, children, ...props }: ComponentProps<'li'> & { state: StepState }) {
  return (
    <StepContext value={state}>
      <li data-slot="stepper-item" data-state={state} className={cn('group/step relative flex min-w-0 flex-1 justify-center', className)} {...props}>
        {children}
      </li>
    </StepContext>
  )
}

export function StepperTrigger({ className, onKeyDown, ...props }: ComponentProps<'button'>) {
  const state = use(StepContext)
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key))
      return
    const triggers = Array.from(event.currentTarget.closest('[data-slot="stepper"]')?.querySelectorAll<HTMLButtonElement>('button[data-slot="stepper-trigger"]:not(:disabled)') ?? [])
    const current = triggers.indexOf(event.currentTarget)
    if (current < 0)
      return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? triggers.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + triggers.length) % triggers.length
    triggers[next]?.focus()
  }
  return (
    <button
      type="button"
      data-slot="stepper-trigger"
      data-state={state}
      aria-current={state === 'active' ? 'step' : undefined}
      className={cn('relative z-10 inline-flex min-h-11 min-w-11 cursor-pointer flex-col items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60', className)}
      onKeyDown={handleKeyDown}
      {...props}
    />
  )
}

export function StepperIndicator({ className, ...props }: ComponentProps<'span'>) {
  const state = use(StepContext)
  return (
    <span
      data-slot="stepper-indicator"
      data-state={state}
      className={cn('relative flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-medium text-muted-foreground data-[state=completed]:border-primary data-[state=completed]:bg-primary data-[state=completed]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:ring-4 data-[state=active]:ring-primary/10', transition, className)}
      {...props}
    />
  )
}

export function StepperTitle({ className, ...props }: ComponentProps<'span'>) {
  const state = use(StepContext)
  return <span data-slot="stepper-title" data-state={state} className={cn('whitespace-nowrap text-xs font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=completed]:text-foreground', transition, className)} {...props} />
}

export function StepperSeparator({ className, ...props }: ComponentProps<'span'>) {
  return <span aria-hidden="true" data-slot="stepper-separator" className={cn('pointer-events-none absolute h-px bg-border', transition, className)} {...props} />
}
