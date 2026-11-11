import type { CheckTarget } from '@/lib/resume-checks/types'

export interface CheckRect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface CheckGeometry {
  rects: CheckRect[]
  text: { range: Range; color: string }[]
}

function fieldKey(target: CheckTarget) {
  const parts = target.path.split('/').filter(Boolean)
  const field = target.entryId ? parts[2] : parts[0]

  if (/(?:Duration|duration)$/.test(field)) return 'duration'
  if (/^(eduInfo|workInfo|internshipInfo|campusInfo|projectInfo)$/.test(field))
    return 'content'
  if (
    target.section === 'edu_background' &&
    /^(professional|degree)$/.test(field)
  )
    return 'professionalDegree'
  if (target.section === 'skill_specialty' && target.entryId) return 'skill'
  if (field === 'customFields') return `customFields.${parts[1]}`

  return field
}

function quotedRanges(
  element: HTMLElement,
  quote: string,
  occurrence: number,
): Range[] {
  const nodes: { node: Text; start: number; end: number }[] = []
  let text = ''

  const newline = () => {
    if (!text.endsWith('\n\n')) text += '\n'
  }

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const start = text.length

      text += node.textContent ?? ''
      nodes.push({ node: node as Text, start, end: text.length })

      return
    }
    if (!(node instanceof Element) || node.matches('script, style, template'))
      return
    if (node.tagName === 'BR') {
      newline()

      return
    }

    node.childNodes.forEach(visit)

    if (node.matches('p, div, li, h1, h2, h3, h4, tr')) newline()
  }

  visit(element)

  let index = -1

  for (let i = 0; i <= occurrence; i++) {
    index = text.indexOf(quote, index + 1)

    if (index < 0) return []
  }

  const end = index + quote.length

  return nodes
    .filter((item) => item.end > index && item.start < end)
    .map((item) => {
      const range = document.createRange()

      range.setStart(item.node, Math.max(0, index - item.start))
      range.setEnd(item.node, Math.min(item.node.length, end - item.start))

      return range
    })
}

/** 只测量真实显示页，并裁掉每页内重复源文档的不可见部分。 */
export function locateCheckGeometry(
  root: HTMLElement,
  scroller: HTMLElement,
  target: CheckTarget,
): CheckGeometry {
  const result: CheckGeometry = { rects: [], text: [] }

  if (!target.quote) return result

  const key = `${target.section}/${target.entryId ?? 'singleton'}/${fieldKey(target)}`

  const elements = Array.from(
    root.querySelectorAll<HTMLElement>('[data-comment-node-key]'),
  ).filter(
    (element) =>
      element.dataset.commentNodeKey === key &&
      !element.closest(
        '[data-resume-measurement-source], [data-resume-hidden-page]',
      ),
  )

  const origin = scroller.getBoundingClientRect()

  for (const element of elements) {
    const page = element.closest<HTMLElement>('[data-resume-page-index]')
    const ranges = quotedRanges(element, target.quote, target.occurrence ?? 0)

    if (!page || ranges.length === 0) continue

    const clips = [
      page.querySelector('[data-resume-page-viewport]'),
      element.closest('[data-resume-region-viewport]'),
      element.closest('[data-resume-page-clip]'),
    ]
      .filter((clip): clip is Element => !!clip)
      .map((clip) => clip.getBoundingClientRect())

    const visible: DOMRect[] = []

    for (const range of ranges) {
      const rects = Array.from(range.getClientRects()).flatMap((rect) => {
        const left = Math.max(rect.left, ...clips.map((clip) => clip.left))
        const right = Math.min(rect.right, ...clips.map((clip) => clip.right))
        const top = Math.max(rect.top, ...clips.map((clip) => clip.top))

        const bottom = Math.min(
          rect.bottom,
          ...clips.map((clip) => clip.bottom),
        )

        return right - left >= 1 && bottom - top >= 1
          ? [new DOMRect(left, top, right - left, bottom - top)]
          : []
      })

      if (rects.length === 0) continue

      visible.push(...rects)

      result.text.push({
        range,
        color: getComputedStyle(range.startContainer.parentElement!).color,
      })
    }

    if (visible.length === 0) continue

    const left = Math.min(...visible.map((rect) => rect.left))
    const top = Math.min(...visible.map((rect) => rect.top))

    result.rects.push({
      id: `${key}:${result.rects.length}`,
      x: left - origin.left + scroller.scrollLeft,
      y: top - origin.top + scroller.scrollTop,
      width: Math.max(...visible.map((rect) => rect.right)) - left,
      height: Math.max(...visible.map((rect) => rect.bottom)) - top,
    })
  }

  return result
}
