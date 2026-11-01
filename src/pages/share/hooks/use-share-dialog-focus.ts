import { useRef } from 'react'

export function useShareDialogFocus() {
  const returnFocusRef = useRef<HTMLElement | null>(null)

  return {
    onOpenAutoFocus: () => {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
    },
    onCloseAutoFocus: (event: Event) => {
      const target = getShareReturnFocus(returnFocusRef.current)

      if (!target) return

      event.preventDefault()
      target.focus({ preventScroll: true })
    },
  }
}

export function getShareReturnFocus(preferred: HTMLElement | null) {
  const fallbacks = document.querySelectorAll<HTMLElement>(
    '[data-slot="drawer-popup"] [data-share-dialog-fallback], [data-share-dialog-fallback], #share-management-search',
  )

  return [preferred, ...fallbacks].find(isAvailableFocusTarget) ?? null
}

function isAvailableFocusTarget(
  target: HTMLElement | null,
): target is HTMLElement {
  return Boolean(
    target?.isConnected &&
    target !== document.body &&
    target !== document.documentElement &&
    !target.matches(':disabled') &&
    !target.closest(
      '[data-ending-style], [inert], [aria-hidden="true"], [hidden]',
    ),
  )
}
