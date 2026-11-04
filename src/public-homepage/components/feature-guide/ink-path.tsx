import type { ComponentProps } from 'react'

export function InkPath(props: ComponentProps<'path'>) {
  return (
    <path
      {...props}
      pathLength={1}
      strokeDasharray='1 2'
      strokeDashoffset={1}
    />
  )
}
