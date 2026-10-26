import type { CheckTarget } from '@/lib/resume-checks/types'
import { collectTextRangeClientRects } from '@/features/resume-comments/anchors/geometry'

export interface CheckRect {
  id: string
  x: number
  y: number
  width: number
  height: number
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

function quotedRange(
  element: HTMLElement,
  quote: string,
  occurrence: number,
): Range | null {
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

    if (index < 0) return null
  }

  const end = index + quote.length
  const first = nodes.find((item) => item.end > index)
  const last = nodes.find((item) => item.end >= end)

  if (!first || !last) return null

  const range = document.createRange()

  range.setStart(first.node, index - first.start)
  range.setEnd(last.node, end - last.start)

  return range
}

/** 只测量真实显示页，并裁掉每页内重复源文档的不可见部分。 */
export function locateCheckRects(
  root: HTMLElement,
  scroller: HTMLElement,
  target: CheckTarget,
): CheckRect[] {
  if (!target.quote) return []

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
  const result: CheckRect[] = []

  for (const element of elements) {
    const page = element.closest<HTMLElement>('[data-resume-page-index]')
    const range = quotedRange(element, target.quote, target.occurrence ?? 0)

    if (!page || !range) continue

    const clips = [
      page.querySelector('[data-resume-page-viewport]'),
      element.closest('[data-resume-region-viewport]'),
      element.closest('[data-resume-page-clip]'),
    ]
      .filter((clip): clip is Element => !!clip)
      .map((clip) => clip.getBoundingClientRect())

    for (const rect of collectTextRangeClientRects(range)) {
      const left = Math.max(rect.left, ...clips.map((clip) => clip.left))
      const right = Math.min(rect.right, ...clips.map((clip) => clip.right))
      const top = Math.max(rect.top, ...clips.map((clip) => clip.top))
      const bottom = Math.min(rect.bottom, ...clips.map((clip) => clip.bottom))

      if (right - left < 1 || bottom - top < 1) continue

      const next = {
        id: `${key}:${result.length}`,
        x: left - origin.left + scroller.scrollLeft,
        y: top - origin.top + scroller.scrollTop,
        width: right - left,
        height: bottom - top,
      }

      const previous = result.at(-1)

      if (
        previous &&
        Math.abs(previous.y - next.y) < 2 &&
        Math.abs(previous.x + previous.width - next.x) < 3
      ) {
        previous.width = next.x + next.width - previous.x
        previous.height = Math.max(previous.height, next.height)
      } else result.push(next)
    }
  }

  return result
}
