import type { CheckSnapshot, CheckTarget, ResumeCheckIssue } from './types'
import { collectCheckFields } from './targets'

/** 排版只提醒阅读风险；没有渲染证据时不推测分页错误。 */
export function checkResumeLayout(
  snapshot: CheckSnapshot,
  root?: HTMLElement | null,
): ResumeCheckIssue[] {
  const fields = collectCheckFields(snapshot)

  const first = fields[0] ?? {
    section: 'basics' as const,
    path: '/name',
    quote: '',
  }

  const issues: ResumeCheckIssue[] = []
  const signature = JSON.stringify(snapshot)

  const add = (
    id: string,
    title: string,
    detail: string,
    targets: CheckTarget[],
  ) => {
    issues.push({
      id: `layout:${id}`,
      section: targets[0].section,
      kind: 'layout',
      source: 'layout',
      severity: 'suggestion',
      title,
      detail,
      targets,
      signature,
      resolved: false,
    })
  }

  if (snapshot.font.fontSize < 12) {
    add(
      'font-size',
      '正文字号偏小',
      `当前为 ${snapshot.font.fontSize} px，打印后可能较难阅读。可在工具栏“字体”中调大。`,
      [first],
    )
  }
  if (snapshot.spacing.lineHeight < 1.25) {
    add(
      'line-height',
      '正文行距偏紧',
      '可在工具栏“间距”中稍微增大行距，检查长段文字是否拥挤。',
      [first],
    )
  }

  if (!root) return issues

  const clipped = new Map<string, CheckTarget>()
  const orphans = new Map<string, CheckTarget>()

  root
    .querySelectorAll<HTMLElement>('[data-resume-page-clip]')
    .forEach((clip) => {
      if (!clip.closest('[data-resume-page-index]')) return

      const bounds = clip.getBoundingClientRect()

      const viewport = clip
        .closest('[data-resume-region-viewport]')
        ?.getBoundingClientRect()

      if (!viewport || bounds.height < 1) return

      const top = Math.max(bounds.top, viewport.top)
      const bottom = Math.min(bounds.bottom, viewport.bottom)
      const left = Math.max(bounds.left, viewport.left)
      const right = Math.min(bounds.right, viewport.right)
      const scale = bounds.width / Math.max(1, clip.offsetWidth)

      clip
        .querySelectorAll<HTMLElement>('[data-comment-node-key]')
        .forEach((element) => {
          const [section, entryId] = (
            element.dataset.commentNodeKey ?? ''
          ).split('/')

          const target = fields.find(
            (field) =>
              field.section === section &&
              (entryId === 'singleton'
                ? !field.entryId
                : field.entryId === entryId) &&
              element.textContent?.includes(field.quote),
          )

          if (!target) return

          const range = document.createRange()

          range.selectNodeContents(element)

          const overflowing = Array.from(range.getClientRects()).some(
            (rect) =>
              rect.bottom > top + 1 &&
              rect.top < bottom - 1 &&
              rect.height > 0 &&
              (rect.left < left - 2 * scale || rect.right > right + 2 * scale),
          )

          if (overflowing)
            clipped.set(`${target.section}:${target.path}`, target)
        })

      clip
        .querySelectorAll<HTMLElement>(
          'h2, h3, [data-pagination-keep-with-next]',
        )
        .forEach((heading) => {
          const rect = heading.getBoundingClientRect()
          const next = heading.nextElementSibling

          const section =
            heading.closest<HTMLElement>('[data-section]')?.dataset.section

          const target = fields.find((field) => field.section === section)

          // 只有标题确实在本页、紧邻正文从下一段才开始时才提醒。
          if (
            !target ||
            !next ||
            rect.height < 1 ||
            rect.top < top ||
            rect.bottom > bottom + 1
          )
            return
          if (
            next.getBoundingClientRect().top >= bottom &&
            bottom - rect.bottom < 32 * scale
          ) {
            orphans.set(target.section, target)
          }
        })
    })

  if (clipped.size)
    add(
      'clipped',
      '部分文字超出版面',
      '预览中检测到文字越过内容边缘。请检查长链接、字号或模板宽度。',
      [...clipped.values()],
    )
  if (orphans.size)
    add(
      'orphan-heading',
      '标题与正文可能分在两页',
      '标题位于页尾，而后续内容未出现在本页。可调整间距后再查看。',
      [...orphans.values()],
    )

  return issues
}
