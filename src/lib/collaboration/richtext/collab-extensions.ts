import type { Awareness } from 'y-protocols/awareness'
import type { XmlFragment } from 'yjs'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { Highlight } from '@tiptap/extension-highlight'
import { Image } from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { TextAlign } from '@tiptap/extension-text-align'
import { Typography } from '@tiptap/extension-typography'
import { Selection } from '@tiptap/extensions'
import { StarterKit } from '@tiptap/starter-kit'
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension'
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension'
import { handleImageUpload, MAX_FILE_SIZE } from '@/lib/tiptap-utils'

export interface CollabExtensionConfig {
  fragment: XmlFragment
  provider: { awareness: Awareness }
  user: { name: string, color: string }
}

interface BuildExtensionsOptions {
  onImageError?: (message: string) => void
  collab?: CollabExtensionConfig
}

/** 远端光标 DOM：彩色竖线 + 姓名标签（配套 .collaboration-carets CSS）。 */
function renderCaret(user: Record<string, any>): HTMLElement {
  const cursor = document.createElement('span')
  cursor.classList.add('collaboration-carets__caret')
  cursor.setAttribute('style', `border-color: ${user.color}`)

  const label = document.createElement('div')
  label.classList.add('collaboration-carets__label')
  label.setAttribute('style', `background-color: ${user.color}`)
  label.insertBefore(document.createTextNode(user.name ?? ''), null)

  cursor.insertBefore(label, null)
  return cursor
}

/**
 * 构造 SimpleEditor 的扩展数组。
 *
 * standalone（无 `collab`）：与历史行为完全一致。
 * collaborative（有 `collab`）：关闭 StarterKit 自带 history（改由 Yjs undo/redo 接管），
 * 追加 `Collaboration`（绑定 fragment）与 `CollaborationCaret`（渲染远端光标）。
 *
 * 注意：必须保留 `horizontalRule: false`（避免与单独注册的 HorizontalRule 重复），
 * 以及 `link` 配置。
 */
export function buildEditorExtensions({ onImageError, collab }: BuildExtensionsOptions = {}) {
  const starterKit = StarterKit.configure({
    horizontalRule: false,
    link: {
      openOnClick: false,
      enableClickSelection: true,
    },
    // 协作模式下由 Yjs 提供 undo/redo，关闭 StarterKit 自带 history 以免冲突
    ...(collab ? { undoRedo: false } : {}),
  })

  const extensions: any[] = [
    starterKit,
    HorizontalRule,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: true }),
    Image,
    Typography,
    Superscript,
    Subscript,
    Selection,
    ImageUploadNode.configure({
      accept: 'image/*',
      maxSize: MAX_FILE_SIZE,
      limit: 2,
      upload: handleImageUpload,
      onError: error => onImageError?.(error.message),
    }),
  ]

  if (collab) {
    extensions.push(
      Collaboration.configure({ fragment: collab.fragment }),
      CollaborationCaret.configure({
        provider: collab.provider,
        user: collab.user,
        render: renderCaret,
      }),
    )
  }

  return extensions
}
