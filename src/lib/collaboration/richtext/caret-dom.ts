/** 远端光标 DOM：彩色竖线 + 姓名标签（配套 .collaboration-carets CSS）。 */
export function createCollaborationCaret(user: Record<string, any>): HTMLElement {
  const cursor = document.createElement('span')
  cursor.classList.add('collaboration-carets__caret')
  cursor.setAttribute('style', `border-color: ${user.color}`)

  const label = document.createElement('span')
  label.classList.add('collaboration-carets__label')
  label.setAttribute('style', `background-color: ${user.color}`)
  label.insertBefore(document.createTextNode(user.name ?? ''), null)

  cursor.insertBefore(label, null)
  return cursor
}
