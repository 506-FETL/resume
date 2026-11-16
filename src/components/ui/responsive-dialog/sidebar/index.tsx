import * as React from 'react'
import { useResponsiveDialogContext } from '../context'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

export function ResponsiveDialogSidebar({
  children,
  className,
  title,
  description,
}: {
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
}) {
  const { isMobile, variant } = useResponsiveDialogContext()

  if (isMobile || variant !== 'sidebar') return null

  return (
    <div
      className={cn(
        'w-64 bg-muted/30 border-r border-border/60 flex flex-col shrink-0',
        className,
      )}
    >
      {(title || description) && (
        <div className='p-6 shrink-0'>
          {title && (
            <h2 className='text-xl font-bold tracking-tight'>{title}</h2>
          )}
          {description && (
            <p className='text-xs text-muted-foreground mt-1'>{description}</p>
          )}
        </div>
      )}
      <nav
        className='flex-1 px-3 py-2 space-y-1 overflow-y-auto'
        role='tablist'
      >
        {children}
      </nav>
    </div>
  )
}

export function ResponsiveDialogSidebarItem({
  id,
  label,
  icon: Icon,
  className,
}: {
  id: string
  label: string
  icon?: React.ElementType
  className?: string
}) {
  const { activeSection, setActiveSection, errors } =
    useResponsiveDialogContext()

  const isActive = activeSection === id
  const hasError = errors?.[id]

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setActiveSection(id)

    const element = document.getElementById(id)

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <button
      role='tab'
      aria-selected={isActive}
      aria-controls={id}
      onClick={handleClick}
      className={cn(
        'w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors relative group',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            'size-4 mr-3 shrink-0',
            isActive
              ? 'text-primary'
              : 'text-muted-foreground group-hover:text-accent-foreground',
          )}
        />
      )}
      <span className='truncate'>{label}</span>
      {hasError && (
        <AlertCircle className='size-3.5 ml-auto text-destructive animate-pulse shrink-0' />
      )}
    </button>
  )
}
