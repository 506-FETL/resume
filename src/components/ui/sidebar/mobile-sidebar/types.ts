import type { ComponentProps } from 'react'

export type MobileSidebarProps = ComponentProps<'div'> & {
  side: 'left' | 'right'
}
