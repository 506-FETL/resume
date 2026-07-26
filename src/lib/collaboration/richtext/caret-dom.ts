/** 远端光标 DOM：只展示彩色竖线，不创建昵称气泡。 */
export function createCollaborationCaret(user: { color?: unknown }): HTMLElement {
  const cursor = document.createElement('span')
  cursor.classList.add('collaboration-carets__caret')
  cursor.style.borderColor = typeof user.color === 'string' ? user.color : 'currentColor'
  return cursor
}
