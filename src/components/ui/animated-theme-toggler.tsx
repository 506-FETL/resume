import { cn } from '@/lib/utils'
import { Moon, Sun } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { useTheme } from '../theme-provider'
import { Button } from './button'

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<'button'> {
  duration?: number
}

export const AnimatedThemeToggler = ({
  className,
  duration = DURATION.slow * 1000,
  ...props
}: AnimatedThemeTogglerProps) => {
  const { theme, setTheme } = useTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const reduceMotion = useReducedMotion()
  const activeTransition = useRef<ViewTransition | null>(null)
  const activeAnimation = useRef<Animation | null>(null)

  useEffect(() => {
    return () => {
      activeTransition.current?.skipTransition()
      activeAnimation.current?.cancel()
      activeTransition.current = null
    }
  }, [reduceMotion])

  const toggleTheme = useCallback(() => {
    const button = buttonRef.current

    if (!button) return

    const { top, left, width, height } = button.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight

    const maxRadius = Math.hypot(
      Math.max(x, viewportWidth - x),
      Math.max(y, viewportHeight - y),
    )

    const applyTheme = () => {
      setTheme(theme === 'dark' ? 'light' : 'dark')
    }

    if (reduceMotion || typeof document.startViewTransition !== 'function') {
      applyTheme()

      return
    }

    activeTransition.current?.skipTransition()
    activeAnimation.current?.cancel()

    const transition = document.startViewTransition(() => {
      flushSync(applyTheme)
    })

    activeTransition.current = transition

    const ready = transition?.ready

    if (ready && typeof ready.then === 'function') {
      ready
        .then(() => {
          if (activeTransition.current !== transition) return

          activeAnimation.current = document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${maxRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration,
              easing: `cubic-bezier(${EASE.out.join(',')})`,
              pseudoElement: '::view-transition-new(root)',
            },
          )
        })
        .catch(() => undefined)
    }
  }, [theme, duration, reduceMotion, setTheme])

  return (
    <Button
      variant='ghost'
      size='icon'
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(className)}
      {...props}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
      <span className='sr-only'>切换主题</span>
    </Button>
  )
}
