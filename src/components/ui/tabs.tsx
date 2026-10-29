import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { CONTENT_SWITCH, DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface TabsMotionContextValue {
  value?: string
  displayedValue?: string
  finishExit: () => void
  registerContent: (value: string) => () => void
}

const TabsMotionContext = React.createContext<TabsMotionContextValue | null>(
  null,
)

const TabsIndicatorContext = React.createContext({
  id: '',
  variant: 'default' as 'default' | 'line',
})

function Tabs({
  className,
  orientation = 'horizontal',
  value: controlledValue,
  defaultValue,
  onValueChange,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const value = controlledValue ?? uncontrolledValue
  const [displayedValue, setDisplayedValue] = React.useState(value)
  const animatedContents = React.useRef(new Set<string>())
  const requestedValue = React.useRef(value)

  requestedValue.current = value

  const reduced = useReducedMotion()

  const registerContent = React.useCallback((contentValue: string) => {
    animatedContents.current.add(contentValue)

    return () => {
      animatedContents.current.delete(contentValue)

      setDisplayedValue((displayed) =>
        displayed === contentValue ? requestedValue.current : displayed,
      )
    }
  }, [])

  const handleValueChange = (nextValue: string) => {
    if (controlledValue === undefined) setUncontrolledValue(nextValue)

    onValueChange?.(nextValue)
  }

  React.useLayoutEffect(() => {
    const canAnimate =
      value !== undefined &&
      displayedValue !== undefined &&
      animatedContents.current.has(value) &&
      animatedContents.current.has(displayedValue)

    if (!canAnimate || reduced) setDisplayedValue(value)
  })

  return (
    <TabsMotionContext
      value={{
        value,
        displayedValue: reduced ? value : displayedValue,
        finishExit: () => setDisplayedValue(value),
        registerContent,
      }}
    >
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        onValueChange={handleValueChange}
        orientation={orientation}
        data-slot='tabs'
        data-orientation={orientation}
        className={cn(
          'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col',
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsMotionContext>
  )
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const id = React.useId()

  return (
    <TabsIndicatorContext value={{ id, variant: variant ?? 'default' }}>
      <TabsPrimitive.List
        data-slot='tabs-list'
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </TabsIndicatorContext>
  )
}

function TabsTrigger({
  className,
  children,
  value,
  asChild,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const context = React.useContext(TabsMotionContext)
  const { id, variant } = React.useContext(TabsIndicatorContext)
  const reduced = useReducedMotion()
  const active = context?.value === value

  // 已有业务指示条负责自己的颜色与布局，避免与公共指示条重叠。
  const hasCustomIndicator = React.Children.toArray(children).some(
    (child) =>
      React.isValidElement(child) &&
      'layoutId' in (child.props as Record<string, unknown>),
  )

  return (
    <TabsPrimitive.Trigger
      value={value}
      asChild={asChild}
      data-slot='tabs-trigger'
      data-tab-value={value}
      className={cn(
        "relative isolate inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-[color,border-color,box-shadow,opacity] group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 dark:text-muted-foreground dark:hover:text-foreground data-[state=active]:text-foreground dark:data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {active && !hasCustomIndicator && (
            <motion.span
              aria-hidden
              data-slot='tabs-indicator'
              layoutId={`tabs-indicator-${id}`}
              initial={false}
              className={cn(
                'pointer-events-none absolute -z-10',
                variant === 'default'
                  ? 'inset-0 rounded-[inherit] bg-background shadow-sm dark:border dark:border-input dark:bg-input/30'
                  : 'bg-foreground group-data-[orientation=horizontal]/tabs:inset-x-0 group-data-[orientation=horizontal]/tabs:bottom-[-5px] group-data-[orientation=horizontal]/tabs:h-0.5 group-data-[orientation=vertical]/tabs:inset-y-0 group-data-[orientation=vertical]/tabs:-right-1 group-data-[orientation=vertical]/tabs:w-0.5',
              )}
              transition={{
                duration: reduced ? 0 : DURATION.fast,
                ease: EASE.out,
              }}
            />
          )}
          {children}
        </>
      )}
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  forceMount,
  asChild,
  children,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  const context = React.useContext(TabsMotionContext)
  const reduced = useReducedMotion()
  const displayed = context?.displayedValue === value
  const exiting = displayed && context?.value !== value
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  const managesVisibility =
    forceMount || asChild || className?.includes('data-[state=inactive]:hidden')

  const registerContent = context?.registerContent

  React.useLayoutEffect(() => {
    if (managesVisibility) return

    return registerContent?.(value)
  }, [managesVisibility, registerContent, value])

  React.useLayoutEffect(() => {
    const content = contentRef.current

    if (!content || managesVisibility) return

    if ((!displayed || exiting) && content.contains(document.activeElement)) {
      content
        .closest('[data-slot=tabs]')
        ?.querySelector<HTMLButtonElement>('[role=tab][data-state=active]')
        ?.focus({ preventScroll: true })
    }

    content.inert = !displayed || exiting

    if (!displayed || exiting) content.setAttribute('aria-hidden', 'true')
    else content.removeAttribute('aria-hidden')
  }, [displayed, exiting, managesVisibility])

  if (managesVisibility) {
    return (
      <TabsPrimitive.Content
        data-slot='tabs-content'
        value={value}
        forceMount={forceMount}
        asChild={asChild}
        className={cn('flex-1 text-sm outline-none', className)}
        {...props}
      >
        {children}
      </TabsPrimitive.Content>
    )
  }

  return (
    <TabsPrimitive.Content
      data-slot='tabs-content'
      value={value}
      forceMount
      hidden={!displayed}
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
      asChild
    >
      <motion.div
        ref={contentRef}
        initial={false}
        animate={{
          opacity: displayed && !exiting ? 1 : 0,
          transform:
            (displayed && !exiting) || reduced
              ? 'translateY(0px)'
              : 'translateY(4px)',
        }}
        transition={{
          ...(exiting ? CONTENT_SWITCH.exit : CONTENT_SWITCH.enter),
          ...(reduced && { duration: 0 }),
          delay: 0,
        }}
        onAnimationComplete={() => {
          if (exiting) context?.finishExit()
        }}
      >
        {displayed ? children : null}
      </motion.div>
    </TabsPrimitive.Content>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
