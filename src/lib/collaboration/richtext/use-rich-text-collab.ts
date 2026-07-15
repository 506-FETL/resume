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

  const selfColor = useCollaborationStore(state => state.selfColor)
  const userName = useCollaborationStore(state =>
    (state.selfPeerId ? state.participants[state.selfPeerId]?.metadata?.userName : undefined),
  )

  const key = buildFragmentKey(sectionKey, relativePath)

  return useMemo(() => {
    if (!ready || !session || !provider) {
      return undefined
    }
    return {
      fragment: session.getFieldFragment(key),
      provider,
      user: {
        name: (userName as string | undefined) ?? '协作者',
        color: selfColor ?? '#4f46e5',
      },
    }
  }, [ready, session, provider, key, userName, selfColor])
}
