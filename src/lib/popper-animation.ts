import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export function getPopperAnimationProps(style: CSSProperties | undefined) {
  const { animationDuration, animationTimingFunction, ...rest } = style ?? {}

  // Radix Popper 注入 animation 简写，动态长属性改由 CSS 变量承接。
  return {
    className: cn(
      animationDuration != null && 'ui-popper-custom-duration',
      animationTimingFunction != null && 'ui-popper-custom-easing',
    ),
    style: {
      ...rest,
      '--ui-popper-animation-duration': animationDuration,
      '--ui-popper-animation-easing': animationTimingFunction,
    } as CSSProperties,
  }
}
