export function restoreDialogFocus(event: Event, target?: HTMLElement | null) {
  if (!target?.isConnected) return

  event.preventDefault()
  target.focus({ preventScroll: true })
}
