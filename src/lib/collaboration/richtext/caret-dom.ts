/** 远端光标 DOM：只展示彩色竖线，不创建昵称气泡。 */
export function createCollaborationCaret(user: Record<string, any>): HTMLElement {
  const cursor = document.createElement('span')
  cursor.classList.add('collaboration-carets__caret')
  cursor.setAttribute('style', `border-color: ${user.color}`)
  return cursor
}
