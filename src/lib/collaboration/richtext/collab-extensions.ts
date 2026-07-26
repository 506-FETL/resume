import type { Awareness } from 'y-protocols/awareness'
import type { XmlFragment } from 'yjs'
import type { AwarenessLikeState } from './caret-dedupe'
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
import { yCursorPlugin } from '@tiptap/y-tiptap'
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension'
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension'
import { handleImageUpload, MAX_FILE_SIZE } from '@/lib/tiptap-utils'
import { createDedupeAwarenessFilter } from './caret-dedupe'
import { createCollaborationCaret } from './caret-dom'

export interface CollabExtensionConfig {
  fragment: XmlFragment
  provider: { awareness: Awareness }
  user: {
    name: string
    color: string
    /** 稳定的人类身份标识（如登录 userId）。用于按“人”而非易变的 Yjs clientID 去重光标。 */
    id?: string
  }
}

interface BuildExtensionsOptions {
  onImageError?: (message: string) => void
  collab?: CollabExtensionConfig
}

/**
 * `CollaborationCaret` 的去重变体：其余行为完全一致，但给内部的 `yCursorPlugin`
 * 注入一个 `awarenessStateFilter`，按 `user.id`（稳定人类身份）去重——同一个人只渲染
 * “最活跃”的那个 clientId 光标（按是否持有 cursor + awareness.meta.lastUpdated 排序，
 * 注意 Yjs clientID 是随机值不能用于判活），避免重连 / StrictMode / provider 连接竞态
 * 遗留的幽灵 clientId 在 30s 超时回收前叠出多个重复标签。
 *
 * 需重写 `addProseMirrorPlugins`（官方扩展未透出 `awarenessStateFilter` 配置项）。
 * 保持与官方一致：初始化时写入本地 `user`，并把 awareness 状态镜像到 storage.users。
 */
const DedupeCollaborationCaret = CollaborationCaret.extend({
  addProseMirrorPlugins() {
    const awareness = this.options.provider.awareness as Awareness
    const awarenessStatesToArray = (states: Map<number, any>) =>
      Array.from(states.entries()).map(([clientId, value]) => ({ clientId, ...value.user }))

    return [
      yCursorPlugin(
        (() => {
          awareness.setLocalStateField('user', this.options.user)
          this.storage.users = awarenessStatesToArray(awareness.states)
          awareness.on('update', () => {
            this.storage.users = awarenessStatesToArray(awareness.states)
          })
          return awareness
        })(),
        {
          awarenessStateFilter: createDedupeAwarenessFilter(
            () => awareness.getStates() as Map<number, AwarenessLikeState>,
            () => (awareness as unknown as { meta: Map<number, { lastUpdated?: number }> }).meta,
          ),
          cursorBuilder: this.options.render,
          selectionBuilder: this.options.selectionRender,
        },
      ),
    ]
  },
})

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
      DedupeCollaborationCaret.configure({
        provider: collab.provider,
        user: collab.user,
        render: createCollaborationCaret,
      }),
    )
  }

  return extensions
}
