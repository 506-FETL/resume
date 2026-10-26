import type { CheckTarget } from '@/lib/resume-checks/types'
import useResumeStore from '@/store/resume/form'

/** 把稳定条目路径解析为当前表单路径，重排后仍定位到同一条经历。 */
export function checkFormPath(
  target: CheckTarget,
  sectionData: unknown = useResumeStore.getState()[target.section],
): string | null {
  let value: unknown = sectionData
  const parts: string[] = []

  for (const part of target.path.slice(1).split('/')) {
    if (!value || typeof value !== 'object') return null

    const key =
      Array.isArray(value) && part.startsWith('@')
        ? value.findIndex((item) => item?.entryId === part.slice(1))
        : part

    if (key === -1) return null

    parts.push(String(key))
    value = (value as Record<string, unknown>)[key]
  }

  return parts.join('.')
}

/** 等待抽屉/折叠内容挂载，禁止聚焦已隐藏的检查页。 */
export function focusCheckField(target: CheckTarget, reduced: boolean) {
  let frame = 0
  let cancelled = false
  const started = performance.now()
  const identity = useResumeStore.getState().currentResumeId

  const seek = () => {
    if (cancelled || useResumeStore.getState().currentResumeId !== identity)
      return

    const path = checkFormPath(target)

    if (!path) return

    const fields = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-resume-check-workspace] [data-form-field]',
      ),
    )

    const field = fields.find((element) => {
      const name = element.dataset.formField

      const section = element.closest<HTMLElement>('[data-editor-section]')
        ?.dataset.editorSection

      return (
        (name === path || name === path.replace(/\.[01]$/, '')) &&
        section === target.section &&
        !element.closest('[inert], [aria-hidden="true"]') &&
        element.getBoundingClientRect().height > 8
      )
    })

    if (field) {
      const inputs = Array.from(
        field.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]), textarea, [contenteditable="true"], button:not([disabled])',
        ),
      )

      const datePart = path.match(/\.(\d)$/)

      const input =
        field.querySelector<HTMLElement>('[contenteditable="true"]') ??
        inputs[datePart ? Number(datePart[1]) : 0] ??
        inputs[0]

      field.scrollIntoView({
        block: 'center',
        behavior: reduced ? 'instant' : 'smooth',
      })

      input?.focus({ preventScroll: true })

      if (
        (input instanceof HTMLInputElement ||
          input instanceof HTMLTextAreaElement) &&
        target.quote
      ) {
        const start = input.value.indexOf(target.quote)

        if (start >= 0 && /^(text|search|tel|url|password)$/.test(input.type)) {
          input.setSelectionRange(start, start + target.quote.length)
        }
      }

      return
    }

    if (performance.now() - started < 2500) frame = requestAnimationFrame(seek)
  }

  frame = requestAnimationFrame(seek)

  return () => {
    cancelled = true
    cancelAnimationFrame(frame)
  }
}
