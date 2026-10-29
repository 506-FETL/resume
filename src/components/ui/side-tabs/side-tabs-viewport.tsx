'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { PresenceDiv } from '@/components/motion/presence-item'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useSideTabsContext } from './side-tabs-provider'

export function ViewPort({
  fill = 'transparent',
  stroke = 'gray',
  strokeWidth = 1,
  items,
  className,
  scrollable = false,
}: {
  fill?: string
  stroke?: string
  strokeWidth?: number
  items: { id: string; content: ReactNode }[]
  className?: string
  scrollable?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const { box, outlineD, contentRef, active, padding } = useSideTabsContext()

  const activeItem = useMemo(
    () => items.find((item) => item.id === active),
    [items, active],
  )

  return (
    <>
      <svg
        className='absolute inset-0 block z-1'
        width='100%'
        height='100%'
        style={{ overflow: 'visible', pointerEvents: 'none', zIndex: -1 }}
      >
        <defs>
          <filter id='soft-shadow' x='-20%' y='-20%' width='140%' height='140%'>
            <feDropShadow
              dx='0'
              dy='1'
              stdDeviation='1.5'
              floodOpacity='0.12'
            />
          </filter>
        </defs>

        {outlineD && (
          <motion.path
            d={outlineD}
            initial={false}
            animate={{ d: outlineD }}
            transition={reduceMotion ? { duration: 0 } : SPRING.layout}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap='round'
            strokeLinejoin='round'
            vectorEffect='non-scaling-stroke'
            shapeRendering='geometricPrecision'
          />
        )}
      </svg>
      <svg
        className='absolute inset-0 block z-1'
        width='100%'
        height='100%'
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {/* 内容：被闭合路径"包裹"的区域（与盒几何一致） */}
        <foreignObject
          x={box.x}
          y={box.y}
          width={Math.max(box.w, 0)}
          height={Math.max(box.h, 0)}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              padding: `${padding}px`,
              boxSizing: 'border-box',
              pointerEvents: 'auto',
            }}
          >
            <div
              ref={contentRef}
              className={cn(
                scrollable &&
                  'h-full min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]',
              )}
            >
              <AnimatePresence
                mode='wait'
                onExitComplete={() => {
                  if (scrollable && contentRef.current)
                    contentRef.current.scrollTop = 0
                }}
              >
                {activeItem && (
                  <PresenceDiv
                    key={activeItem.id}
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      y: reduceMotion ? 0 : -4,
                      transition: {
                        duration: reduceMotion ? 0 : DURATION.fast,
                        ease: EASE.in,
                      },
                    }}
                    transition={{
                      duration: reduceMotion ? 0 : DURATION.base,
                      ease: EASE.out,
                    }}
                    className={cn('p-6', scrollable && 'min-h-full', className)}
                  >
                    {activeItem.content}
                  </PresenceDiv>
                )}
              </AnimatePresence>
            </div>
          </div>
        </foreignObject>
      </svg>
    </>
  )
}
