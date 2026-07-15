import type { Extensions } from '@tiptap/core'
import type { XmlFragment } from 'yjs'
import { generateJSON, getSchema } from '@tiptap/core'
import { prosemirrorToYXmlFragment } from '@tiptap/y-tiptap'

/**
 * 首次把现有 HTML 注入空的 Yjs fragment（host 种子化）。
 *
 * 仅当 fragment 为空时写入（原子空检查），避免覆盖协作者已有内容或重复注入。
 * 用与编辑器**完全一致**的 extensions 把 HTML → ProseMirror JSON → PM 节点，
 * 再经 `@tiptap/y-tiptap`（与 Collaboration 同一绑定）的 `prosemirrorToYXmlFragment`
 * 写入 fragment，确保节点/标记（highlight、图片、任务列表、水平线等）不丢失。
 *
 * @returns 是否实际执行了注入
 */
export function seedFragmentFromHtml(
  fragment: XmlFragment,
  html: string,
  extensions: Extensions,
): boolean {
  // 原子空检查：非空说明已同步/已注入，跳过
  if (fragment.length > 0) {
    return false
  }

  const trimmed = (html ?? '').trim()
  if (!trimmed) {
    return false
  }

  const schema = getSchema(extensions)
  const json = generateJSON(trimmed, extensions)
  const pmDoc = schema.nodeFromJSON(json)

  // 在文档事务中写入，保证一次性原子注入
  fragment.doc?.transact(() => {
    prosemirrorToYXmlFragment(pmDoc, fragment)
  })

  return true
}
