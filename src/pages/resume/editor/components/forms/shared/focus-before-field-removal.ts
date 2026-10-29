export function focusBeforeFieldRemoval(trigger: HTMLElement) {
  const row = trigger.closest<HTMLElement>('[data-resume-field-row]')
  const form = trigger.closest('form')

  if (!row || !form) return

  const rows = Array.from(
    row.parentElement?.querySelectorAll<HTMLElement>(
      ':scope > [data-resume-field-row]:not([inert])',
    ) ?? [],
  )

  const index = rows.indexOf(row)
  const adjacent = rows[index + 1] ?? rows[index - 1]

  const target =
    adjacent?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, [contenteditable="true"]',
    ) ??
    adjacent?.querySelector<HTMLElement>(
      'button:not([disabled]):not([data-resume-field-remove])',
    ) ??
    form.querySelector<HTMLElement>('[data-resume-field-add]')

  target?.focus({ preventScroll: true })
}
