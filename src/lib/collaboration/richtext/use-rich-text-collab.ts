import type { CollabExtensionConfig } from '@/lib/collaboration/richtext'
import { useMemo } from 'react'
import { buildFragmentKey, useRichTextCollabStore } from '@/lib/collaboration/richtext'
import useCollaborationStore from '@/lib/collaboration/session/store'

/**
 * 为某个富文本字段生成协作配置（fragment + provider + user），未协作时返回 undefined。
 *
 * 传给 `SimpleEditor` 的 `collab` prop。standalone 时（无协作会话或 Yjs 层未就绪）
 * 返回 undefined，编辑器回落普通 HTML 模式。
 */
export function useRichTextCollab(
  sectionKey: string,
  relativePath: string,
): CollabExtensionConfig | undefined {
  const session = useRichTextCollabStore(state => state.session)
  const provider = useRichTextCollabStore(state => state.provider)
  const ready = useRichTextCollabStore(state => state.ready)

  const self = useCollaborationStore(state => state.self)

  const key = buildFragmentKey(sectionKey, relativePath)

  return useMemo(() => {
    if (!ready || !session || !provider || !self) {
      return undefined
    }
    return {
      fragment: session.getFieldFragment(key),
      provider,
      user: {
        name: self.userName,
        color: self.color,
        // 稳定人类身份：用于按“人”去重编辑器光标，避免重连 / 竞态遗留重复竖线。
        id: self.userId,
      },
    }
  }, [ready, session, provider, key, self])
}
