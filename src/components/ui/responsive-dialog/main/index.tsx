import * as React from 'react'
import { useResponsiveDialogContext } from '../context'
import { cn } from '@/lib/utils'

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
    if (variant !== 'sidebar' || !scrollRef.current) return

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

    sections.forEach((section) => observer.observe(section))

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
        <div
          className={cn(
            'px-6 py-3 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 z-10 border-b border-border/40 mb-4',
            isMobile && 'sticky top-0',
          )}
        >
          <h3 className='text-sm font-semibold tracking-tight text-foreground/70 uppercase'>
            {title}
          </h3>
        </div>
      )}
      <div
        className={cn(
          'px-6',
          (isMobile || variant === 'sidebar') && title ? 'pb-8' : 'py-6',
        )}
      >
        {children}
      </div>
    </section>
  )
}
