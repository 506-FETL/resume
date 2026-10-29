import type { PointerEvent, ReactNode } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useCallback, useEffect } from 'react'
import { useTheme } from '@/components/theme-provider'
import { SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'

// Adapted from https://magicui.design/r/magic-card.json.
// Uses the application's theme and motion presets, including reduced-motion support.
interface MagicCardBaseProps {
  children?: ReactNode
  className?: string
  contentClassName?: string
  borderColor?: string
  gradientSize?: number
  gradientFrom?: string
  gradientTo?: string
}

interface MagicCardGradientProps extends MagicCardBaseProps {
  mode?: 'gradient'
  gradientColor?: string
  gradientOpacity?: number
  glowFrom?: never
  glowTo?: never
  glowAngle?: never
  glowSize?: never
  glowBlur?: never
  glowOpacity?: never
}

interface MagicCardOrbProps extends MagicCardBaseProps {
  mode: 'orb'
  glowFrom?: string
  glowTo?: string
  glowAngle?: number
  glowSize?: number
  glowBlur?: number
  glowOpacity?: number
  gradientColor?: never
  gradientOpacity?: never
}

type MagicCardProps = MagicCardGradientProps | MagicCardOrbProps

export function MagicCard({
  children,
  className,
  contentClassName,
  borderColor = 'var(--color-border)',
  gradientSize = 200,
  gradientFrom = '#9E7AFF',
  gradientTo = '#FE8BBB',
  mode = 'gradient',
  gradientColor = '#262626',
  gradientOpacity = 0.8,
  glowFrom = '#ee4f27',
  glowTo = '#6b21ef',
  glowAngle = 90,
  glowSize = 420,
  glowBlur = 60,
  glowOpacity = 0.9,
}: MagicCardProps) {
  const { resolvedTheme } = useTheme()
  const reduceMotion = useReducedMotion()
  const mouseX = useMotionValue(-gradientSize)
  const mouseY = useMotionValue(-gradientSize)
  const orbX = useSpring(mouseX, SPRING.layout)
  const orbY = useSpring(mouseY, SPRING.layout)
  const visibility = useMotionValue(0)
  const orbVisible = useSpring(visibility, SPRING.layout)

  const borderBackground = useMotionTemplate`
    linear-gradient(var(--color-card) 0 0) padding-box,
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientFrom}, ${gradientTo}, ${borderColor} 100%) border-box
  `

  const gradientBackground = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientColor}, transparent 100%)
  `

  const reset = useCallback(() => {
    visibility.set(0)
  }, [visibility])

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion || event.pointerType === 'touch') return

    const rect = event.currentTarget.getBoundingClientRect()

    mouseX.set(event.clientX - rect.left)
    mouseY.set(event.clientY - rect.top)
    visibility.set(mode === 'orb' ? glowOpacity : gradientOpacity)
  }

  useEffect(() => {
    if (reduceMotion) {
      visibility.jump(0)
      orbVisible.jump(0)
      orbX.jump(-gradientSize)
      orbY.jump(-gradientSize)

      return
    }

    const handlePointerOut = (event: globalThis.PointerEvent) => {
      if (!event.relatedTarget) reset()
    }

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') reset()
    }

    window.addEventListener('pointerout', handlePointerOut)
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('pointerout', handlePointerOut)
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [reduceMotion, reset, visibility, orbVisible, orbX, orbY, gradientSize])

  return (
    <motion.div
      data-slot='magic-card'
      data-mode={mode}
      className={cn(
        'relative isolate overflow-hidden rounded-xl border border-transparent bg-card text-card-foreground',
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onFocusCapture={(event) => {
        if (reduceMotion || event.currentTarget.contains(event.relatedTarget))
          return

        const rect = event.currentTarget.getBoundingClientRect()

        mouseX.set(rect.width / 2)
        mouseY.set(rect.height / 2)
        visibility.set(mode === 'orb' ? glowOpacity : gradientOpacity)
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) reset()
      }}
      style={{
        background: reduceMotion ? undefined : borderBackground,
        borderColor: reduceMotion ? borderColor : undefined,
      }}
    >
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 rounded-[inherit] bg-card'
      />
      {!reduceMotion && mode === 'gradient' && (
        <motion.div
          aria-hidden
          className='pointer-events-none absolute inset-px rounded-[inherit]'
          style={{ background: gradientBackground, opacity: orbVisible }}
        />
      )}
      {!reduceMotion && mode === 'orb' && (
        <motion.div
          aria-hidden
          data-slot='magic-card-orb'
          className='pointer-events-none absolute rounded-full'
          style={{
            width: glowSize,
            height: glowSize,
            x: orbX,
            y: orbY,
            translateX: '-50%',
            translateY: '-50%',
            filter: `blur(${glowBlur}px)`,
            opacity: orbVisible,
            background: `linear-gradient(${glowAngle}deg, ${glowFrom}, ${glowTo})`,
            mixBlendMode: resolvedTheme === 'dark' ? 'screen' : 'multiply',
          }}
        />
      )}
      <div className={cn('relative z-10', contentClassName)}>{children}</div>
    </motion.div>
  )
}
