import * as React from 'react'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { AlertCircle } from 'lucide-react'

const ResponsiveDialogContext = React.createContext<{
  activeSection: string
  setActiveSection: (id: string) => void
  isMobile: boolean
  variant: 'default' | 'sidebar'
  errors?: Record<string, boolean>
} | null>(null)

function useResponsiveDialogContext() {
  const context = React.useContext(ResponsiveDialogContext)
  if (!context) {
    throw new Error('useResponsiveDialogContext must be used within ResponsiveDialog')
  }
  return context
}

interface BaseProps {
  children: React.ReactNode
}

interface RootProps extends BaseProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface ResponsiveDialogProps extends RootProps {
  trigger?: React.ReactElement
  variant?: 'default' | 'sidebar'
  errors?: Record<string, boolean>
}

export function ResponsiveDialog({
  children,
  trigger,
  open,
  onOpenChange,
  variant = 'default',
  errors,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()
  const [activeSection, setActiveSection] = React.useState('')

  const contextValue = React.useMemo(() => ({
    activeSection,
    setActiveSection,
    isMobile,
    variant,
    errors,
  }), [activeSection, errors, isMobile, variant])

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={contextValue}>
        <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
          {trigger && <DrawerTrigger render={trigger} />}
          <DrawerContent>
            {children}
          </DrawerContent>
        </Drawer>
      </ResponsiveDialogContext.Provider>
    )
  }

  return (
    <ResponsiveDialogContext.Provider value={contextValue}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent
          className={cn(
            'flex flex-col overflow-hidden p-0 duration-200',
            variant === 'sidebar'
              ? 'h-[min(90vh,880px)] w-[calc(85vw)] sm:max-w-[min(1000px,calc(100vw-2rem))] lg:max-w-[min(1120px,85vw)]'
              : 'max-h-[85vh] sm:max-w-lg',
          )}
        >
          {children}
        </DialogContent>
      </Dialog>
    </ResponsiveDialogContext.Provider>
  )
}

export function ResponsiveDialogContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { variant } = useResponsiveDialogContext()

  return (
    <div
      className={cn(
        'flex flex-1 min-h-0',
        variant === 'sidebar' ? 'flex-row' : 'flex-col',
        className,
      )}
    >
      {children}
    </div>
  )
}

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

  if (isMobile || variant !== 'sidebar')
    return null

  return (
    <div
      className={cn(
        'w-64 bg-muted/30 border-r border-border/60 flex flex-col shrink-0',
        className,
      )}
    >
      {(title || description) && (
        <div className="p-6 shrink-0">
          {title && <h2 className="text-xl font-bold tracking-tight">{title}</h2>}
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
      )}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto" role="tablist">
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
  const { activeSection, setActiveSection, errors } = useResponsiveDialogContext()
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
      role="tab"
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
      {Icon && <Icon className={cn('size-4 mr-3 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-accent-foreground')} />}
      <span className="truncate">{label}</span>
      {hasError && (
        <AlertCircle className="size-3.5 ml-auto text-destructive animate-pulse shrink-0" />
      )}
    </button>
  )
}

export function ResponsiveDialogMain({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { setActiveSection, variant } = useResponsiveDialogContext()
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (variant !== 'sidebar' || !scrollRef.current)
      return

    const observerOptions = {
      root: scrollRef.current,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0,
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id)
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)
    const sections = scrollRef.current.querySelectorAll('section[id]')
    sections.forEach(section => observer.observe(section))

    return () => observer.disconnect()
  }, [variant, setActiveSection])

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ResponsiveDialogSection({
  id,
  title,
  children,
  className,
}: {
  id: string
  title?: string
  children: React.ReactNode
  className?: string
}) {
  const { isMobile, variant } = useResponsiveDialogContext()

  return (
    <section id={id} className={cn('scroll-mt-6', className)}>
      {(isMobile || variant === 'sidebar') && title && (
        <div className={cn(
          'px-6 py-3 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 z-10 border-b border-border/40 mb-4',
          isMobile && 'sticky top-0',
        )}>
          <h3 className="text-sm font-semibold tracking-tight text-foreground/70 uppercase">{title}</h3>
        </div>
      )}
      <div className={cn(
        'px-6',
        (isMobile || variant === 'sidebar') && title ? 'pb-8' : 'py-6',
      )}>
        {children}
      </div>
    </section>
  )
}

export function ResponsiveDialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isMobile, variant } = useResponsiveDialogContext()

  if (variant === 'sidebar' && !isMobile) {
    return (
      <div className="sr-only" {...props}>
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <DrawerHeader className={className} {...props}>
        {children}
      </DrawerHeader>
    )
  }

  return (
    <DialogHeader className={className} {...props}>
      {children}
    </DialogHeader>
  )
}

export function ResponsiveDialogTitle({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const { isMobile } = useResponsiveDialogContext()

  if (isMobile) {
    return (
      <DrawerTitle className={className} {...props}>
        {children}
      </DrawerTitle>
    )
  }

  return (
    <DialogTitle className={className} {...props}>
      {children}
    </DialogTitle>
  )
}

export function ResponsiveDialogDescription({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const { isMobile } = useResponsiveDialogContext()

  if (isMobile) {
    return (
      <DrawerDescription className={className} {...props}>
        {children}
      </DrawerDescription>
    )
  }

  return (
    <DialogDescription className={className} {...props}>
      {children}
    </DialogDescription>
  )
}

export function ResponsiveDialogFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isMobile } = useResponsiveDialogContext()

  if (isMobile) {
    return (
      <DrawerFooter className={className} {...props}>
        {children}
        <DrawerClose render={<button className="hidden" />} />
      </DrawerFooter>
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-end gap-3 border-t border-border/40 bg-muted/20 px-6 py-4 sm:flex-row',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
