/**
 * 读取当前聚焦的自由文本输入框（用于并发编辑时的光标保持）。
 *
 * 读路径在对某字段执行 `setValue` 前调用本函数；若被远端修改的字段恰是当前聚焦的
 * 文本输入框，则在 setValue 后用 `mapCaretByDiff` 还原光标偏移。
 *
 * 仅识别真正的文本 `<input>` / `<textarea>`：`<select>`、日期按钮、Tiptap（contenteditable）
 * 不参与（它们不是受控 text input，其光标由各自逻辑或子项目 B 负责）。
 */

export interface ActiveTextField {
  name: string
  el: HTMLInputElement | HTMLTextAreaElement
}

const TEXT_INPUT_TYPES = new Set([
  'text',
  'email',
  'tel',
  'url',
  'search',
  'number',
  'password',
  '',
])

function isEditableTextInput(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) {
    return true
  }
  if (el instanceof HTMLInputElement) {
    // `type` 为空时浏览器默认 text；显式非文本类型（checkbox/radio/date 等）排除
    return TEXT_INPUT_TYPES.has(el.type)
  }
  return false
}

export function getActiveTextField(): ActiveTextField | null {
  if (typeof document === 'undefined') {
    return null
  }

  const el = document.activeElement
  if (!isEditableTextInput(el) || !el.name) {
    return null
  }

  return { name: el.name, el }
}
