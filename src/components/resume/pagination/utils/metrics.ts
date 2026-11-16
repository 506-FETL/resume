export function hash(value: string) {
  let result = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }

  return (result >>> 0).toString(36)
}

export function isVisible(element: Element) {
  const targetWindow = element.ownerDocument.defaultView

  if (!targetWindow) return false

  const style = targetWindow.getComputedStyle(element)

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.contentVisibility !== 'hidden'
  )
}

export function roundMetric(value: number) {
  return Math.round(value * 100) / 100
}
