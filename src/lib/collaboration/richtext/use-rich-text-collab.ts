import type { CollabExtensionConfig } from '@/lib/collaboration/richtext'
import { useMemo } from 'react'
import { useCurrentUserName } from '@/hooks/use-current-user'
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
  const selfUserId = useCollaborationStore(state => state.selfUserId)
  // 展示名以「当前登录用户」为准（与鼠标光标同源、随认证状态实时解析）。
  // participants[selfPeerId].metadata.userName 是开启协作那一刻冻结的快照——
  // 若彼时 full_name 尚未加载，会被永久固化为「用户-<id>」兜底；这里仍用实时来源
  // 保持 awareness 用户信息准确，即使富文本光标已经不再展示昵称气泡。
  const liveUserName = useCurrentUserName()
  const frozenUserName = useCollaborationStore(state =>
    (state.selfPeerId ? state.participants[state.selfPeerId]?.metadata?.userName : undefined),
  )
  const userName = liveUserName
    || (frozenUserName as string | undefined)
    || (selfUserId ? `用户-${selfUserId.slice(0, 6)}` : undefined)

  const key = buildFragmentKey(sectionKey, relativePath)

  return useMemo(() => {
    if (!ready || !session || !provider) {
      return undefined
    }
    return {
      fragment: session.getFieldFragment(key),
      provider,
      user: {
        name: userName ?? '协作者',
        color: selfColor ?? '#4f46e5',
        // 稳定人类身份：用于按“人”去重编辑器光标，避免重连 / 竞态遗留重复竖线。
        id: selfUserId ?? undefined,
      },
    }
  }, [ready, session, provider, key, userName, selfColor, selfUserId])
}
