'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()
  const reduceMotion = useReducedMotion()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className='toaster group'
      icons={{
        success: <CircleCheckIcon className='size-4' />,
        info: <InfoIcon className='size-4' />,
        warning: <TriangleAlertIcon className='size-4' />,
        error: <OctagonXIcon className='size-4' />,
        loading: <Loader2Icon className='size-4 animate-spin' />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          transitionDuration: reduceMotion
            ? '0s'
            : 'var(--toast-motion-duration, var(--ui-motion-slow))',
          transitionTimingFunction: 'var(--ui-motion-enter-ease)',
        },
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
