import { useRef } from 'react'

// 受控浮层也可能从菜单或键盘打开，记录打开这一刻的入口。
export function useDialogOpener(open: boolean) {
  const openerRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)

  if (open && !wasOpenRef.current) {
    const active = document.activeElement

    openerRef.current =
      active instanceof HTMLElement &&
      active !== document.body &&
      active !== document.documentElement
        ? active
        : null
  }

  wasOpenRef.current = open

  return openerRef.current
}
