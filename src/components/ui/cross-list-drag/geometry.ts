import { INTERACTIVE_SELECTOR } from './constants'
import type { DragPoint } from '@/lib/motion-drag'

export function rectToDragRect(id: string, rect: DOMRect) {
  return {
    id,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  }
}

export function isInteractiveTarget(
  target: EventTarget | null,
  currentTarget: HTMLElement,
): boolean {
  if (!(target instanceof Element)) return false

  const interactive = target.closest(INTERACTIVE_SELECTOR)

  return interactive !== null && interactive !== currentTarget
}

export function distanceBetween(left: DragPoint, right: DragPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}
