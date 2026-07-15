import { create } from 'zustand'
import useResumeStore from '@/store/resume/form'
import { buildEditorExtensions } from './collab-extensions'
import { buildFragmentKey } from './fragment-key'
import { RICH_FIELDS } from './rich-fields'
import { seedFragmentFromHtml } from './seed'
import { SupabaseYjsProvider } from './supabase-yjs-provider'
import { RichTextCollabSession } from './yjs-doc'

interface StartParams {
  resumeId: string
  sessionId: string
  role: 'host' | 'guest'
  userName: string
  color: string
  /** 仅全新 host 分享为 true；加入/重连为 false，避免重复种子化 */
  seed: boolean
}

interface RichTextCollabStore {
  session: RichTextCollabSession | null
  provider: SupabaseYjsProvider | null
  ready: boolean
  start: (params: StartParams) => void
  stop: () => void
}

// host 在 provider 订阅成功后等待初始同步 settle 再种子化的兜底延时。
const SEED_SETTLE_DELAY = 800

// 待执行的种子化定时器，stop() 时取消，避免向已销毁文档注入。
let seedTimer: ReturnType<typeof setTimeout> | null = null

/** 用编辑器同一套扩展（无 collab 分支）供种子化 generateJSON/getSchema 使用。 */
function seedExtensions() {
  return buildEditorExtensions()
}

const useRichTextCollabStore = create<RichTextCollabStore>()((set, get) => ({
  session: null,
  provider: null,
  ready: false,

  start: ({ resumeId, sessionId, role, userName, color, seed }) => {
    // 幂等：先清理已有（覆盖 resumeHosting 重连等无前置 stop 的路径）
    get().stop()

    const session = new RichTextCollabSession()
    const provider = new SupabaseYjsProvider(resumeId, sessionId, session.doc, session.awareness)

    session.setLocalUser({ name: userName, color })
    provider.connect()

    set({ session, provider, ready: true })

    // 仅「全新 host 分享」种子化：等待初始同步 settle 后，对仍为空的 fragment 注入现有 HTML。
    // 加入会话 / resumeHosting 重连不种子化（seed=false），避免与远端已有 Yjs 状态叠加造成重复。
    if (role === 'host' && seed) {
      seedTimer = setTimeout(() => {
        seedTimer = null
        // 会话可能已被销毁
        if (get().session !== session) {
          return
        }
        const data = useResumeStore.getState().getResumeFormData()
        const extensions = seedExtensions()

        for (const entry of RICH_FIELDS) {
          for (const { relativePath, html } of entry.list(data)) {
            try {
              const key = buildFragmentKey(entry.sectionKey as string, relativePath)
              const fragment = session.getFieldFragment(key)
              seedFragmentFromHtml(fragment, html, extensions)
            }
            catch (error) {
              console.warn('[richtext-collab] seed failed:', error)
            }
          }
        }
      }, SEED_SETTLE_DELAY)
    }
  },

  stop: () => {
    if (seedTimer !== null) {
      clearTimeout(seedTimer)
      seedTimer = null
    }
    const { session, provider } = get()
    provider?.destroy()
    session?.destroy()
    if (session || provider) {
      set({ session: null, provider: null, ready: false })
    }
  },
}))

export default useRichTextCollabStore
