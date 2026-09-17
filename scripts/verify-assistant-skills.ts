import assert from 'node:assert/strict'
import process from 'node:process'
import { createServer } from 'vite'

// 使用真实 Vite 转换和内置 Markdown；仅替换模型网络流，验证 Agent 的运行行为。
const server = await createServer({
  server: { middlewareMode: true, watch: null, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
})
let checks = 0
function passed(name: string) {
  checks++
  process.stdout.write(`✓ ${name}\n`)
}
const message = (role: string, parts: unknown[]) => ({ id: `${role}-${crypto.randomUUID()}`, conversationId: 'qa', userId: 'qa', role, parts, createdAt: new Date().toISOString() })
async function* response(toolCalls: { name: string, args: unknown }[] = [], text = '') {
  yield {
    choices: [{ delta: {
      content: text,
      reasoning_content: toolCalls.length ? '根据当前任务选择下一步工具。' : undefined,
      tool_calls: toolCalls.length ? toolCalls.map((call, index) => ({ index, id: crypto.randomUUID(), type: 'function', function: { name: call.name, arguments: JSON.stringify(call.args) } })) : undefined,
    }, finish_reason: toolCalls.length ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }
}

try {
  const { createSkillReferences, createUserParts, getEditableMessageText } = await server.ssrLoadModule('/src/lib/ai/skills/references.ts')
  const { loadSkill, readSkillResource } = await server.ssrLoadModule('/src/lib/ai/skills/loader.ts')
  const { createSkillRuntime, buildSkillCatalogContext } = await server.ssrLoadModule('/src/lib/ai/skills/runtime.ts')
  const { runAgent } = await server.ssrLoadModule('/src/lib/ai/agent/agent-loop.ts')
  const { toApiMessages } = await server.ssrLoadModule('/src/lib/ai/agent/to-api-messages.ts')

  const refs = createSkillReferences('$asu 帮我优化项目经历', ['great-resume'])
  assert.equal(refs.length, 1)
  assert.equal(refs[0].skillId, 'great-resume')
  assert.equal(createSkillReferences('/great-resume 优化')[0].skillId, 'great-resume')
  assert.deepEqual(createSkillReferences('邮箱 me$test@example.com，预算 $100。`$unknown`\n```\n$unknown\n```'), [])
  assert.throws(() => createSkillReferences('$unknown 优化'), /未找到技能/)
  passed('明确点名、别名、去重、未知技能与材料中的普通符号')

  const parts = createUserParts('优化项目经历', refs)
  const restored = JSON.parse(JSON.stringify(parts))
  assert.deepEqual(createSkillReferences(getEditableMessageText(restored)), refs)
  assert.deepEqual(createSkillReferences('优化项目经历'), [])
  passed('引用持久化、编辑恢复与删除点名')

  const loaded = await loadSkill('great-resume', '1.0.0')
  assert.equal(typeof loaded.instructions, 'string')
  assert.match(loaded.instructions, /^---\nname: great-resume/)
  assert.match(loaded.instructions, /update_current_resume_field/)
  for (const resource of loaded.resources) {
    const data = await readSkillResource('great-resume', resource.path, '1.0.0')
    assert.equal(typeof data.content, 'string')
    assert.match(data.content, /^# /)
  }
  await assert.rejects(loadSkill('unknown'), /未找到/)
  await assert.rejects(loadSkill('great-resume', '0.0.1'), /版本/)
  for (const path of ['../SKILL.md', '/etc/passwd', 'https://example.com/a.md', 'references/unknown.md', 'references\\claim-evidence-ledger.md'])
    await assert.rejects(readSkillResource('great-resume', path))
  passed('真实 Markdown 加载、版本和资源白名单边界')

  const controller = new AbortController()
  const runtime = createSkillRuntime({ signal: controller.signal })
  const activation = runtime.tools.find((tool: { name: string }) => tool.name === 'activate_skill')
  const resourceReader = runtime.tools.find((tool: { name: string }) => tool.name === 'read_skill_resource')
  const resourceArgs = { skillId: 'great-resume', path: loaded.resources[0].path }
  await assert.rejects(resourceReader.execute(resourceArgs), /先调用/)
  assert.equal(typeof (await activation.execute({ skillId: 'great-resume' })).instructions, 'string')
  const duplicate = await activation.execute({ skillId: 'great-resume' })
  assert.equal(duplicate.alreadyLoaded, true)
  assert.equal(duplicate.instructions, undefined)
  await assert.rejects(activation.execute({ skillId: 'great-resume', version: '0.0.1' }), /版本/)
  assert.equal(typeof (await resourceReader.execute(resourceArgs)).content, 'string')
  assert.equal((await resourceReader.execute(resourceArgs)).content, undefined)
  const isolated = createSkillRuntime({ signal: new AbortController().signal })
  await assert.rejects(isolated.tools.find((tool: { name: string }) => tool.name === 'read_skill_resource').execute(resourceArgs), /先调用/)
  passed('每轮隔离、先激活后读资料、同轮内容去重')

  const explicitRequests: any[] = []
  const activities: any[] = []
  const explicitParts = await runAgent({
    history: [message('user', parts)],
    signal: new AbortController().signal,
    callbacks: { onSkillActivity: (activity: unknown) => activities.push(activity) },
  }, {
    tools: [],
    request: async (request: unknown) => {
      explicitRequests.push(structuredClone(request))
      return response([], '请补充你在项目中负责的具体部分。')
    },
  })
  assert.deepEqual(activities.map(activity => activity.state), ['loading', 'ready'])
  assert.match(explicitRequests[0].messages[0].content, /# ASu 简历提升/)
  assert.equal(explicitParts[0].state, 'ready')
  assert.equal(explicitRequests.length, 1)
  passed('明确引用在模型请求前真实加载，加载事件与最终消息一致')

  const followupRequests: any[] = []
  await runAgent({ history: [message('user', parts), message('assistant', explicitParts), message('user', [{ type: 'text', text: '换个话题，今天是几号？' }])], signal: new AbortController().signal }, {
    tools: [],
    request: async (request: unknown) => {
      followupRequests.push(structuredClone(request))
      return response([], '新话题。')
    },
  })
  assert.doesNotMatch(JSON.stringify(followupRequests[0].messages), /# ASu 简历提升/)
  assert.match(buildSkillCatalogContext(), /great-resume@1.0.0/)
  assert.doesNotMatch(buildSkillCatalogContext(), /# ASu 简历提升/)
  passed('新任务仅使用轻量目录，历史技能不成为永久模式')

  const autoRequests: any[] = []
  const rounds = [
    [{ name: 'activate_skill', args: { skillId: 'great-resume' } }],
    [{ name: 'read_skill_resource', args: resourceArgs }],
    [],
  ]
  const autoParts = await runAgent({ history: [message('user', [{ type: 'text', text: '用 ASu 优化我的经历' }])], signal: new AbortController().signal }, {
    tools: [],
    request: async (request: unknown) => {
      autoRequests.push(structuredClone(request))
      const calls = rounds.shift()!
      return response(calls, calls.length ? '' : '建议基于已确认的事实改写。')
    },
  })
  assert.equal(autoRequests.length, 3)
  assert.match(JSON.stringify(autoRequests[1].messages), /# ASu 简历提升/)
  assert.match(JSON.stringify(autoRequests[2].messages), /主张/)
  assert.equal(autoParts.filter((part: any) => part.type === 'tool-call' && part.state === 'result').length, 2)
  const apiHistory = toApiMessages([message('assistant', autoParts)])
  assert.deepEqual(apiHistory.map((item: any) => item.role), ['system', 'assistant', 'tool', 'assistant', 'tool', 'assistant'])
  assert.equal(apiHistory[1].tool_calls[0].function.name, 'activate_skill')
  assert.equal(apiHistory[3].tool_calls[0].function.name, 'read_skill_resource')
  assert.doesNotMatch(JSON.stringify(apiHistory), /# ASu 简历提升/)
  assert.equal(JSON.parse(apiHistory[2].content).version, '1.0.0')
  passed('自然语言经真实工具加载、资料读取、历史依赖顺序与正文压缩')

  const cancellation = new AbortController()
  let writes = 0
  await assert.rejects(runAgent({ history: [message('user', [{ type: 'text', text: '检查取消' }])], signal: cancellation.signal }, {
    tools: [
      {
        name: 'read_then_stop',
        mode: 'read',
        description: '',
        parameters: {},
        execute: async () => {
          cancellation.abort()
          return { ok: true }
        },
      },
      {
        name: 'write_after_stop',
        mode: 'write',
        description: '',
        parameters: {},
        execute: async () => {
          writes++
          return { ok: true }
        },
      },
    ],
    request: async () => response([{ name: 'read_then_stop', args: {} }, { name: 'write_after_stop', args: {} }]),
  }), { name: 'AbortError' })
  assert.equal(writes, 0)
  passed('同批工具之间取消后，不执行后续写操作')

  let modelRequests = 0
  await assert.rejects(runAgent({ history: [message('user', [{ ...refs[0], version: '0.0.1' }, { type: 'text', text: '继续' }])], signal: new AbortController().signal }, {
    tools: [],
    request: async () => {
      modelRequests++
      return response([], '不应执行')
    },
  }), /版本/)
  assert.equal(modelRequests, 0)
  passed('失效版本不静默降级、不消耗模型请求')
  process.stdout.write(`\n${checks} 组技能行为验证通过。\n`)
}
finally {
  await server.close()
}
