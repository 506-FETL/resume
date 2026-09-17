import type { Plugin } from 'vite'
import assert from 'node:assert/strict'
import process from 'node:process'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const mocks: Record<string, string> = {
  'sonner': 'export const toast = { error() {}, info() {} }',
  '@/lib/ai/agent': `
    export const buildUserContext = () => globalThis.__assistantStopTest.buildContext()
    export const runAgent = args => globalThis.__assistantStopTest.runAgent(args)
  `,
  '@/lib/ai/skills/references': `
    export const createSkillReferences = () => []
    export const createUserParts = text => [{ type: 'text', text }]
    export const getSkillReferences = () => []
  `,
  '@/lib/llm/call': 'export class QuotaExceededError extends Error {}',
  '@/lib/supabase/ai': `
    export const createConversation = () => globalThis.__assistantStopTest.createConversation()
    export const deleteConversation = () => Promise.resolve()
    export const insertMessage = (...args) => globalThis.__assistantStopTest.insertMessage(...args)
    export const touchConversation = () => Promise.resolve()
    export const updateConversation = () => Promise.resolve({})
  `,
  '@/store/ai-quota': 'export const refetchAiQuota = () => {}',
  '@/store/upgrade-dialog': 'export const openUpgradeDialog = () => {}',
  '@/utils': 'export const getErrorMessage = error => error instanceof Error ? error.message : String(error)',
  '../const': 'export const CONVERSATION_TITLE_MAX_LEN = 50; export const DEFAULT_CONVERSATION_TITLE = \'新对话\'',
  '../store': `
    const state = globalThis.__assistantStopTest.state
    const setState = update => Object.assign(state, typeof update === 'function' ? update(state) : update)
    state.setState = setState
    state.appendMessage = message => setState(current => ({ messages: [...current.messages, message] }))
    state.replaceMessage = (id, message) => setState(current => ({ messages: current.messages.map(item => item.id === id ? message : item) }))
    state.removeMessage = id => setState(current => ({ messages: current.messages.filter(item => item.id !== id) }))
    state.setStreamingParts = parts => setState({ streamingParts: parts })
    state.setStreamingUsage = usage => setState({ streamingUsage: usage })
    state.setUsageForMessage = () => {}
    state.bumpCanvasRefresh = () => {}
    state.upsertConversation = () => {}
    state.setActiveConversationId = id => setState({ activeConversationId: id })
    state.beginConversationRun = id => setState(current => ({ inFlightConversationIds: { ...current.inFlightConversationIds, [id]: true } }))
    state.finishConversationRun = id => setState(current => { const { [id]: ignored, ...inFlightConversationIds } = current.inFlightConversationIds; return { inFlightConversationIds } })
    const store = selector => selector ? selector(state) : state
    store.getState = () => state
    store.setState = setState
    export function cancelActiveAssistantRun() {
      state.pendingConfirm?.resolve(false)
      state.abortController?.abort()
      setState({ streaming: false, streamingText: '', streamingParts: [], streamingUsage: null, abortController: null })
    }
    export default store
  `,
  '../utils': 'export const writeLastConversationId = () => {}',
  './use-canvas-preview': 'export const invalidateCanvasSnapshot = () => {}',
}

const resolvedMockIds: Record<string, string> = {
  '/src/lib/ai/agent/index.ts': '@/lib/ai/agent',
  '/src/lib/ai/skills/references.ts': '@/lib/ai/skills/references',
  '/src/lib/llm/call.ts': '@/lib/llm/call',
  '/src/lib/supabase/ai.ts': '@/lib/supabase/ai',
  '/src/store/ai-quota.ts': '@/store/ai-quota',
  '/src/store/upgrade-dialog.ts': '@/store/upgrade-dialog',
  '/src/utils/index.ts': '@/utils',
  '/src/pages/assistant/const.ts': '../const',
  '/src/pages/assistant/store.ts': '../store',
  '/src/pages/assistant/utils.ts': '../utils',
  '/src/pages/assistant/hooks/use-canvas-preview.ts': './use-canvas-preview',
}

const mockPlugin: Plugin = {
  name: 'assistant-stop-order-mocks',
  enforce: 'pre',
  resolveId(source) {
    const normalized = source.replace(process.cwd(), '')
    const mockId = mocks[source] ? source : resolvedMockIds[normalized]
    return mockId ? `\0assistant-stop-order:${mockId}` : null
  },
  load(id) {
    if (!id.startsWith('\0assistant-stop-order:'))
      return null
    return mocks[id.slice('\0assistant-stop-order:'.length)]
  },
}

function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0))
}
function makeMessage(id: string, role: 'user' | 'assistant', text: string) {
  return {
    id,
    conversationId: 'conversation-a',
    userId: 'test',
    role,
    parts: [{ type: 'text', text }],
    createdAt: new Date().toISOString(),
  }
}

const db: ReturnType<typeof makeMessage>[] = []
const runs: Deferred<unknown>[] = []
let pendingAssistantInsert: Deferred<void> | null = null
const testState = {
  activeConversationId: 'conversation-a' as string | null,
  messages: [] as ReturnType<typeof makeMessage>[],
  streaming: false,
  streamingText: '',
  streamingParts: [] as unknown[],
  streamingUsage: null,
  deepThinking: false,
  abortController: null as AbortController | null,
  inFlightConversationIds: {} as Record<string, true>,
  pendingConfirm: null,
}

Object.assign(globalThis, {
  requestAnimationFrame: (callback: (timestamp: number) => void) => {
    callback(0)
    return 1
  },
  cancelAnimationFrame: () => {},
  __assistantStopTest: {
    state: testState,
    buildContext: () => Promise.resolve('context'),
    createConversation: () => Promise.resolve({ id: 'created' }),
    insertMessage: async (conversationId: string, input: { role: 'user' | 'assistant', parts: unknown[] }) => {
      const message = { id: `db-${db.length + 1}`, conversationId, userId: 'test', role: input.role, parts: input.parts, createdAt: new Date().toISOString() }
      if (input.role === 'assistant' && pendingAssistantInsert)
        await pendingAssistantInsert.promise
      db.push(message as ReturnType<typeof makeMessage>)
      return message
    },
    runAgent: (args: { callbacks: { onSkillActivity: (activity: unknown) => void } }) => {
      args.callbacks.onSkillActivity({ type: 'skill-activity', id: `activity-${runs.length}`, skillId: 'great-resume', version: '1.0.0', displayName: 'ASu 简历提升', state: 'ready' })
      const run = deferred<unknown>()
      runs.push(run)
      return run.promise
    },
  },
})

const server = await createServer({
  configFile: false,
  plugins: [mockPlugin],
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, watch: null, ws: false },
  ssr: { external: ['react', 'react-dom/server'] },
  appType: 'custom',
})

try {
  const { useChatStream } = await server.ssrLoadModule('/src/pages/assistant/hooks/use-chat-stream.ts')
  let stream: ReturnType<typeof useChatStream>
  function Capture() {
    stream = useChatStream()
    return null
  }
  renderToStaticMarkup(createElement(Capture))

  assert.equal(stream.sendMessage('第一轮'), true)
  await nextTick()
  assert.equal(runs.length, 1)
  stream.stopStreaming()
  assert.equal(testState.streaming, false)
  assert.equal(stream.sendMessage('第二轮'), false)
  assert.equal(db.map(message => message.role).join(','), 'user')
  assert.deepEqual(Object.keys(testState.inFlightConversationIds), ['conversation-a'])
  runs[0].reject(new DOMException('aborted', 'AbortError'))
  await nextTick()
  await nextTick()
  assert.deepEqual(db.map(message => message.role), ['user', 'assistant'])
  assert.match(JSON.stringify(db[1].parts), /已停止本次回复/)
  assert.deepEqual(Object.keys(testState.inFlightConversationIds), [])
  assert.equal(stream.sendMessage('第二轮'), true)
  await nextTick()
  runs[1].resolve([{ type: 'text', text: '第二轮完成' }])
  await nextTick()
  await nextTick()
  assert.deepEqual(db.map(message => message.role), ['user', 'assistant', 'user', 'assistant'])
  assert.match(JSON.stringify(db[3].parts), /第二轮完成/)

  // 完整回复已进入落库时停止，也必须在同会话接回已保存的 assistant 消息。
  db.length = 0
  runs.length = 0
  testState.activeConversationId = 'conversation-a'
  testState.messages = []
  testState.streaming = false
  testState.abortController = null
  testState.inFlightConversationIds = {}
  pendingAssistantInsert = deferred<void>()
  assert.equal(stream.sendMessage('保存中的完整回复'), true)
  await nextTick()
  runs[0].resolve([{ type: 'text', text: '已完整生成' }])
  await nextTick()
  stream.stopStreaming()
  assert.equal(stream.sendMessage('仍应等待'), false)
  pendingAssistantInsert.resolve()
  await nextTick()
  await nextTick()
  assert.deepEqual(db.map(message => message.role), ['user', 'assistant'])
  assert.match(JSON.stringify(testState.messages.at(-1)?.parts), /已完整生成/)
  assert.deepEqual(Object.keys(testState.inFlightConversationIds), [])
  pendingAssistantInsert = null

  // 切走并回到 A 时，A 的锁仍阻止新请求；旧运行落库后才放行。
  db.length = 0
  runs.length = 0
  testState.activeConversationId = 'conversation-a'
  testState.messages = []
  testState.streaming = false
  testState.abortController = null
  testState.inFlightConversationIds = {}
  assert.equal(stream.sendMessage('切换前'), true)
  await nextTick()
  stream.stopStreaming()
  testState.activeConversationId = 'conversation-b'
  testState.messages = [makeMessage('b-user', 'user', 'B 会话')]
  assert.equal(stream.sendMessage('B 会话可继续'), true)
  await nextTick()
  runs[1].resolve([{ type: 'text', text: 'B 完成' }])
  await nextTick()
  await nextTick()
  testState.activeConversationId = 'conversation-a'
  testState.messages = [db[0]]
  assert.equal(stream.sendMessage('不应提前发送'), false)
  runs[0].reject(new DOMException('aborted', 'AbortError'))
  await nextTick()
  await nextTick()
  assert.equal(testState.messages.at(-1)?.role, 'assistant')
  assert.equal(stream.sendMessage('回到 A 后继续'), true)
  await nextTick()
  runs[2].resolve([{ type: 'text', text: '继续完成' }])
  await nextTick()
  await nextTick()
  assert.deepEqual(db.filter(message => message.conversationId === 'conversation-a').map(message => message.role), ['user', 'assistant', 'user', 'assistant'])

  process.stdout.write('✓ use-chat-stream 停止锁、回切会话与数据库因果顺序验证通过\n')
}
finally {
  await server.close()
}
