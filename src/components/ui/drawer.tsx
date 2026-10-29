'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer'
import { useMergeRefs } from '@floating-ui/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'
import { PortalContainerProvider } from '@/components/ui/portal-container'

type DrawerContextProps = {
  hasSnapPoints: boolean
  modal: DrawerPrimitive.Root.Props['modal']
  showSwipeHandle: boolean
  swipeDirection: NonNullable<DrawerPrimitive.Root.Props['swipeDirection']>
}

const DrawerContext = React.createContext<DrawerContextProps | null>(null)

function useDrawer() {
  const context = React.useContext(DrawerContext)

  if (!context) {
    throw new Error('useDrawer must be used within a Drawer.')
  }

  return context
}

function useDrawerMotion(forwardedRef: React.Ref<HTMLDivElement> | undefined) {
  const reduceMotion = useReducedMotion()
  const motionRef = React.useRef<HTMLDivElement | null>(null)
  const ref = useMergeRefs([motionRef, forwardedRef])

  React.useLayoutEffect(() => {
    const element = motionRef.current

    if (!reduceMotion || !element) return

    const motionElements = [
      element,
      ...element.querySelectorAll<HTMLElement>(
        ':scope > [data-slot="drawer-content"], :scope > [data-slot="drawer-swipe-handle"]',
      ),
    ]

    // 修改 transition-duration 不会终止浏览器已经启动的 CSS 过渡。
    for (const motionElement of motionElements) {
      motionElement
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .forEach((animation) => animation.finish())
    }
  }, [reduceMotion])

  return { reduceMotion, ref }
}

function Drawer({
  modal = true,
  showSwipeHandle = false,
  snapPoints,
  swipeDirection = 'down',
  ...props
}: DrawerPrimitive.Root.Props & {
  showSwipeHandle?: boolean
}) {
  const hasSnapPoints = snapPoints != null && snapPoints.length > 0

  const contextValue = React.useMemo(
    () => ({ hasSnapPoints, modal, showSwipeHandle, swipeDirection }),
    [hasSnapPoints, modal, showSwipeHandle, swipeDirection],
  )

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Root
        data-slot='drawer'
        modal={modal}
        snapPoints={snapPoints}
        swipeDirection={swipeDirection}
        {...props}
      />
    </DrawerContext.Provider>
  )
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot='drawer-trigger' {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot='drawer-portal' {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot='drawer-close' {...props} />
}

function DrawerOverlay({
  className,
  style,
  ref: forwardedRef,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  const { reduceMotion, ref: motionRef } = useDrawerMotion(forwardedRef)

  return (
    <DrawerPrimitive.Backdrop
      data-slot='drawer-overlay'
      ref={motionRef}
      style={(state) => ({
        ...(typeof style === 'function' ? style(state) : style),
        ...(reduceMotion && { transitionDuration: '0s' }),
      })}
      className={cn(
        'fixed inset-0 z-50 min-h-dvh bg-black/30 opacity-[max(var(--drawer-overlay-min-opacity,0),calc(1-var(--drawer-swipe-progress)))] transition-opacity duration-(--ui-motion-slow) ease-(--ui-motion-enter-ease) select-none data-ending-style:pointer-events-none data-ending-style:opacity-0 data-ending-style:duration-(--ui-motion-fast) data-snap-points:[--drawer-overlay-min-opacity:0.5] data-starting-style:opacity-0 data-swiping:duration-0 supports-backdrop-filter:backdrop-blur-sm supports-[-webkit-touch-callout:none]:absolute',
        className,
      )}
      {...props}
    />
  )
}

function DrawerSwipeHandle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-swipe-handle'
      aria-hidden='true'
      className={cn(
        'relative z-10 flex shrink-0 cursor-grab transition-opacity duration-(--ui-motion-base) group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-[swipe-axis=x]/drawer-popup:h-full group-data-[swipe-axis=x]/drawer-popup:w-3 group-data-[swipe-axis=x]/drawer-popup:items-center group-data-[swipe-axis=y]/drawer-popup:h-3 group-data-[swipe-axis=y]/drawer-popup:w-full group-data-[swipe-axis=y]/drawer-popup:justify-center group-data-[swipe-direction=down]/drawer-popup:items-end group-data-[swipe-direction=left]/drawer-popup:order-last group-data-[swipe-direction=left]/drawer-popup:justify-start group-data-[swipe-direction=right]/drawer-popup:justify-end group-data-[swipe-direction=up]/drawer-popup:order-last group-data-[swipe-direction=up]/drawer-popup:items-start after:block after:shrink-0 after:rounded-full after:bg-muted group-data-[swipe-axis=x]/drawer-popup:after:h-[100px] group-data-[swipe-axis=x]/drawer-popup:after:w-1.5 group-data-[swipe-axis=y]/drawer-popup:after:h-1.5 group-data-[swipe-axis=y]/drawer-popup:after:w-[100px] active:cursor-grabbing',
        className,
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  overlayClassName,
  style,
  ref: forwardedRef,
  ...props
}: DrawerPrimitive.Popup.Props & {
  overlayClassName?: string
}) {
  const { hasSnapPoints, modal, showSwipeHandle, swipeDirection } = useDrawer()
  const { reduceMotion, ref: motionRef } = useDrawerMotion(forwardedRef)

  const [contentElement, setContentElement] =
    React.useState<HTMLDivElement | null>(null)

  const swipeAxis =
    swipeDirection === 'down' || swipeDirection === 'up' ? 'y' : 'x'

  return (
    <DrawerPortal data-slot='drawer-portal'>
      {modal === true && (
        <DrawerOverlay
          data-snap-points={hasSnapPoints ? '' : undefined}
          className={overlayClassName}
        />
      )}
      <DrawerPrimitive.Viewport
        data-slot='drawer-viewport'
        data-modal={modal}
        className='pointer-events-none fixed inset-x-0 top-0 bottom-(--drawer-keyboard-inset,0px) z-50 select-none data-[modal=true]:pointer-events-auto'
      >
        <DrawerPrimitive.Popup
          data-slot='drawer-popup'
          ref={motionRef}
          style={(state) => ({
            ...(typeof style === 'function' ? style(state) : style),
            ...(reduceMotion && { transitionDuration: '0s' }),
          })}
          data-swipe-axis={swipeAxis}
          data-snap-points={hasSnapPoints ? '' : undefined}
          className={cn(
            // Base.
            'group/drawer-popup pointer-events-auto absolute z-50 m-(--drawer-inset,0px) flex h-(--drawer-content-height) max-h-[min(var(--drawer-content-max-height,100%),calc(100%-var(--drawer-inset,0px)*2))] min-h-0 w-(--drawer-content-width,auto) transform-[translate3d(var(--translate-x,0px),var(--translate-y,0px),0)_scale(var(--stack-scale))] flex-col rounded-[min(var(--radius-4xl),24px)] border border-popover bg-popover text-sm text-popover-foreground shadow-xl transition-[transform,opacity,filter] duration-(--ui-motion-slow) ease-(--ui-motion-enter-ease) will-change-transform outline-none select-none [--drawer-bleed-background:transparent] [--drawer-inset:--spacing(2)] [--drawer-stacked-shadow:0_-20px_25px_-5px_rgb(0_0_0/0.1),0_-8px_10px_-6px_rgb(0_0_0/0.1)] data-[swipe-direction=down]:data-nested-drawer-open:shadow-(--drawer-stacked-shadow) dark:border-border',
            // Nested.
            'data-nested-drawer-open:overflow-hidden data-nested-drawer-open:brightness-95',
            // Bleed.
            'after:pointer-events-none after:absolute after:bg-(--drawer-bleed-background,var(--color-popover)) data-[swipe-axis=x]:after:inset-y-0 data-[swipe-axis=x]:after:w-(--bleed) data-[swipe-axis=y]:after:inset-x-0 data-[swipe-axis=y]:after:h-(--bleed) data-[swipe-direction=down]:after:top-full data-[swipe-direction=left]:after:right-full data-[swipe-direction=right]:after:left-full data-[swipe-direction=up]:after:bottom-full',
            // Sizing.
            '[--drawer-content-height:var(--drawer-height,auto)] data-[swipe-axis=x]:[--drawer-content-width:75%] data-[swipe-axis=y]:[--drawer-content-height:70dvh] data-[swipe-axis=y]:[--drawer-content-max-height:70dvh] data-[swipe-axis=x]:sm:[--drawer-content-width:24rem]',
            // Stack.
            '[--bleed:3rem] [--peek:1rem] [--stack-height:var(--drawer-frontmost-height,var(--drawer-height,0px))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-scale-base:max(0,calc(1-(var(--nested-drawers)*var(--stack-step))))] [--stack-scale:clamp(0,calc(var(--stack-scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--stack-shrink:calc(1-var(--stack-scale))] [--stack-step:0.05]',
            // Transitions.
            'data-ending-style:transform-(--closed-transform) data-ending-style:opacity-[0.9999] data-ending-style:duration-(--ui-motion-fast) data-nested-drawer-swiping:duration-0 data-ending-style:data-nested-drawer-swiping:duration-(--ui-motion-fast) data-starting-style:transform-(--closed-transform) data-swiping:duration-0 data-ending-style:data-swiping:duration-(--ui-motion-fast)',
            // Axis: y.
            'data-[swipe-axis=y]:inset-x-0 data-[swipe-axis=y]:data-nested-drawer-open:h-(--stack-height)',
            // Axis: x.
            'data-[swipe-axis=x]:inset-y-0 data-[swipe-axis=x]:flex-row',
            // Direction: down.
            'data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:origin-bottom data-[swipe-direction=down]:[--closed-transform:translate3d(0,calc(100%+var(--drawer-inset,0px)+2px),0)] data-[swipe-direction=down]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--stack-shrink)*var(--stack-height)))]',
            // Direction: up.
            'data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:origin-top data-[swipe-direction=up]:[--closed-transform:translate3d(0,calc(-100%-var(--drawer-inset,0px)-2px),0)] data-[swipe-direction=up]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)+var(--stack-peek-offset)+(var(--stack-shrink)*var(--stack-height)))]',
            // Direction: left.
            'data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:origin-left data-[swipe-direction=left]:[--closed-transform:translate3d(calc(-100%-var(--drawer-inset,0px)-2px),0,0)] data-[swipe-direction=left]:[--translate-x:calc(var(--drawer-swipe-movement-x)+var(--stack-peek-offset)+(var(--stack-shrink)*100%))]',
            // Direction: right.
            'data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:origin-right data-[swipe-direction=right]:[--closed-transform:translate3d(calc(100%+var(--drawer-inset,0px)+2px),0,0)] data-[swipe-direction=right]:[--translate-x:calc(var(--drawer-swipe-movement-x)-var(--stack-peek-offset)-(var(--stack-shrink)*100%))]',
            className,
          )}
          {...props}
        >
          {showSwipeHandle && <DrawerSwipeHandle />}
          <DrawerPrimitive.Content
            data-slot='drawer-content'
            data-base-ui-swipe-ignore=''
            className={cn(
              'flex min-h-0 flex-1 touch-auto flex-col overflow-hidden overscroll-contain rounded-[inherit] transition-opacity duration-(--ui-motion-base) ease-(--ui-motion-enter-ease) select-text group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-swiping/drawer-popup:select-none',
            )}
            ref={setContentElement}
          >
            <PortalContainerProvider container={contentElement}>
              {children}
            </PortalContainerProvider>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-header'
      className={cn(
        'flex shrink-0 flex-col gap-0.5 p-4 pb-0 group-data-[swipe-axis=y]/drawer-popup:text-center md:gap-1.5 md:text-left',
        className,
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-footer'
      className={cn('mt-auto flex shrink-0 flex-col gap-2 p-4 pt-0', className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot='drawer-title'
      className={cn(
        'cn-font-heading text-base font-medium text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot='drawer-description'
      className={cn('text-sm text-balance text-muted-foreground', className)}
      {...props}
    />
  )
}

function DrawerVirtualKeyboardProvider({
  ...props
}: DrawerPrimitive.VirtualKeyboardProvider.Props) {
  return <DrawerPrimitive.VirtualKeyboardProvider {...props} />
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerSwipeHandle,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerVirtualKeyboardProvider,
}
