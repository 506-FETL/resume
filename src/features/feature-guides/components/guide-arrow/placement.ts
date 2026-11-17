export function getArrowPlacement(target: DOMRect, popover: DOMRect) {
  const horizontal =
    popover.right <= target.left || popover.left >= target.right

  const targetCenter = {
    x: target.left + target.width / 2,
    y: target.top + target.height / 2,
  }

  const start = horizontal
    ? {
        x: popover.right <= target.left ? popover.right : popover.left,
        y: Math.max(
          popover.top + 6,
          Math.min(popover.bottom - 6, targetCenter.y),
        ),
      }
    : {
        x: Math.max(
          popover.left + 6,
          Math.min(popover.right - 6, targetCenter.x),
        ),
        y: popover.bottom <= target.top ? popover.bottom : popover.top,
      }

  const end = horizontal
    ? {
        x: popover.right <= target.left ? target.left : target.right,
        y: targetCenter.y,
      }
    : {
        x: targetCenter.x,
        y: popover.bottom <= target.top ? target.top : target.bottom,
      }

  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    angle: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
  }
}
