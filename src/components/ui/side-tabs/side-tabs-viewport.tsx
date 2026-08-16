'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
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
  items: { id: string, content: ReactNode }[]
  className?: string
  scrollable?: boolean
}) {
  const { box, outlineD, contentRef, active, padding } = useSideTabsContext()
  const activeItem = useMemo(() => items.find(item => item.id === active), [items, active])

  return (
    <>
      <svg
        className="absolute inset-0 block z-1"
        width="100%"
        height="100%"
        style={{ overflow: 'visible', pointerEvents: 'none', zIndex: -1 }}
      >
        <defs>
          <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.12" />
          </filter>
        </defs>

        {outlineD && (
          <motion.path
            d={outlineD}
            initial={false}
            animate={{ d: outlineD }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            shapeRendering="geometricPrecision"
          />
        )}
      </svg>
      <svg
        className="absolute inset-0 block z-1"
        width="100%"
        height="100%"
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {/* 内容：被闭合路径"包裹"的区域（与盒几何一致） */}
        <foreignObject x={box.x} y={box.y} width={Math.max(box.w, 0)} height={Math.max(box.h, 0)}>
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
                scrollable && 'h-full min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]',
              )}
            >
              <AnimatePresence
                mode="wait"
                onExitComplete={() => {
                  if (scrollable && contentRef.current)
                    contentRef.current.scrollTop = 0
                }}
              >
                {activeItem && (
                  <motion.div
                    key={activeItem.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{
                      duration: 0.2,
                      ease: [0.25, 0.1, 0.25, 1.0],
                    }}
                    className={cn('p-6', scrollable && 'min-h-full', className)}
                  >
                    {activeItem.content}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </foreignObject>
      </svg>
    </>
  )
}
