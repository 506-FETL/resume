import assert from 'node:assert/strict'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// 只回放合成响应；不请求模型、不创建或修改用户简历。
const mockId = '\0verify-jd-variant:llm-call'
const lodashId = '\0verify-jd-variant:lodash'
const server = await createServer({
  configFile: false,
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  optimizeDeps: { noDiscovery: true, include: [] },
  cacheDir: 'node_modules/.cache/verify-jd-variant',
  server: { middlewareMode: true, watch: null, ws: false },
  appType: 'custom',
  plugins: [{
    name: 'verify-jd-variant-transport',
    enforce: 'pre',
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/lib/llm/index.ts')) {
        // SSR 的 CJS 命名导出适配；仍使用真实 throttle 验证排队与取消。
        return code.replace('from \'lodash\'', 'from \'virtual:verify-jd-variant-lodash\'')
      }
    },
    resolveId(source, importer) {
      if (source === 'virtual:verify-jd-variant-lodash') {
        return lodashId
      }
      if (source === 'virtual:verify-jd-variant-call'
        || (source === './call' && importer?.replaceAll('\\', '/').endsWith('/src/lib/llm/index.ts'))) {
        return mockId
      }
    },
    load(id) {
      if (id === lodashId) {
        return `import lodash from 'lodash'; export const throttle = lodash.throttle;`
      }
      if (id === mockId) {
        return `let factory;
export function setStreamFactory(next) { factory = next; }
export function callLLM(...args) { return factory(...args); }`
      }
    },
  }],
})

const changes = [
  {
    section: 'job_intent',
    itemId: 'whole',
    fieldPath: 'content',
    before: '负责前端页面开发与交付',
    after: '负责 H5 前端开发与交付',
    matchedKeywords: ['前端开发', 'H5', 'PC Web'],
    reason: '突出 H5/PC Web 方向',
  },
  {
    section: 'skill_specialty',
    itemId: 'whole',
    fieldPath: 'content',
    before: '熟悉 JavaScript、TypeScript 和组件开发',
    after: '熟悉 JavaScript、TypeScript 与 React 组件开发',
    matchedKeywords: ['JavaScript', 'React'],
    reason: '突出前端技术和主流框架',
  },
  {
    section: 'project_experience',
    itemId: 'project-1',
    fieldPath: 'description',
    before: '<p title="括号 } ] { [、引号 \\" 和路径 C:\\work">开发前端组件，维护 PC Web 页面并完成需求交付。</p>\n下一行',
    after: '<p title="括号 } ] { [、引号 \\" 和路径 C:\\work">开发 React 组件，维护 PC Web 页面并完成需求交付。</p>\n下一行',
    matchedKeywords: ['React', 'PC Web'],
    reason: '保留 HTML 和转义字符',
  },
]
const raw = JSON.stringify({ changes }, null, 2)
const snapshot = {
  job_intent: { jobIntent: changes[0].before },
  skill_specialty: { description: changes[1].before },
  project_experience: { items: [{ entryId: 'project-1', projectInfo: changes[2].before }] },
}
const errors: unknown[][] = []
const originalError = console.error
let failures = 0

async function check(name: string, run: () => void | Promise<void>) {
  try {
    await run()
    process.stdout.write(`✓ ${name}\n`)
  }
  catch (error) {
    failures++
    process.stderr.write(`✗ ${name}: ${String(error)}\n`)
  }
}

function chunk(content = '', reasoning = '', finishReason: string | null = null) {
  return { choices: [{ delta: { content, reasoning_content: reasoning }, finish_reason: finishReason }] }
}
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

try {
  const { parseVariantResponse } = await server.ssrLoadModule('/src/components/jd-variant/utils/parse-response.ts')
  const { runJdVariantParse, runJdVariantRewrite } = await server.ssrLoadModule('/src/lib/llm/index.ts')
  const { setStreamFactory } = await server.ssrLoadModule('virtual:verify-jd-variant-call')
  console.error = (...args: unknown[]) => {
    errors.push(args)
  }

  await check('逐字符分片只展示完整记录，未闭合的记录不提前显示', () => {
    let previousCount = 0
    for (let end = 0; end <= raw.length; end++) {
      const result = parseVariantResponse(raw.slice(0, end), { strict: false })
      assert.ok(result.changes.length >= previousCount, `进度在字符 ${end} 回退`)
      assert.deepEqual(result.changes, changes.slice(0, result.changes.length))
      previousCount = result.changes.length
    }
    const firstEnd = raw.indexOf('\n    }') + '\n    }'.length
    assert.deepEqual(parseVariantResponse(raw.slice(0, firstEnd), { strict: false }).changes, changes.slice(0, 1))
    assert.equal(parseVariantResponse(raw.slice(0, -2), { strict: false }).changes.length, 3)
  })

  await check('正常流式片段不会记录 JSON 解析错误', () => {
    assert.equal(errors.length, 0)
  })

  await check('代码围栏、字符串中的括号和转义引号不会破坏预览边界', () => {
    assert.deepEqual(parseVariantResponse(`\`\`\`json\n${raw.slice(0, -2)}`, { strict: false }).changes, changes)
    const wrapped = JSON.stringify({ metadata: { changes: [changes[0]] }, changes })
    assert.deepEqual(parseVariantResponse(wrapped.slice(0, -3), { strict: false }).changes, changes.slice(0, 2))
    assert.deepEqual(parseVariantResponse(JSON.stringify({ metadata: { changes } }), { strict: false }).changes, [])
  })

  await check('最终结果继续执行完整 JSON、字段白名单和原文校验', () => {
    assert.deepEqual(parseVariantResponse(raw, { strict: true, snapshot }).changes, changes)
    assert.throws(() => parseVariantResponse(raw.slice(0, -2), { strict: true, snapshot }))
    assert.throws(() => parseVariantResponse(JSON.stringify({ changes: [{ ...changes[0], fieldPath: 'name' }, ...changes.slice(1)] }), { strict: true, snapshot }))
    assert.throws(() => parseVariantResponse(raw, { strict: true, snapshot: { ...snapshot, job_intent: { jobIntent: '不同原文' } } }))
  })

  await check('JSON 正文与思考分开收集，正常结束保留最终更新', async () => {
    setStreamFactory(async function* () {
      yield chunk('', '这里只是思考，包含 { 不完整 JSON')
      yield chunk(raw.slice(0, 100))
      yield chunk(raw.slice(100))
      yield chunk('', '', 'stop')
    })
    const updates: Array<{ content?: string, reasoning?: string }> = []
    const result = await runJdVariantRewrite({ resumeJson: {}, jdText: '合成 JD', keywords: ['React'] }, (update: { content?: string, reasoning?: string }) => updates.push(update))
    assert.equal(result.content, raw)
    assert.equal(result.reasoning, '这里只是思考，包含 { 不完整 JSON')
    assert.equal(updates.at(-1)?.content, raw)
  })

  await check('关键词解析与改写均拒绝截断、中断及内容过滤的响应', async () => {
    for (const finish of ['length', null, 'content_filter', 'tool_calls']) {
      for (const run of [
        () => runJdVariantParse('合成 JD'),
        () => runJdVariantRewrite({ resumeJson: {}, jdText: '合成 JD', keywords: ['React'] }),
      ]) {
        setStreamFactory(async function* () {
          yield chunk(raw)
          if (finish)
            yield chunk('', '', finish)
        })
        await assert.rejects(run, /不完整|中断|过滤/)
      }
    }
  })

  await check('只有思考但无正文的响应不能视为生成成功', async () => {
    setStreamFactory(async function* () {
      yield chunk('', '合成思考')
      yield chunk('', '', 'stop')
    })
    await assert.rejects(runJdVariantRewrite({ resumeJson: {}, jdText: '合成 JD', keywords: ['React'] }), /未返回有效结果/)
  })

  await check('流异常结束后，节流队列不再更新任务', async () => {
    setStreamFactory(async function* () {
      yield chunk('{')
      yield chunk('"changes":[')
      throw new Error('合成断流')
    })
    const updates: unknown[] = []
    await assert.rejects(runJdVariantParse('合成 JD', (update: unknown) => updates.push(update), { throttleMs: 25 }), /合成断流/)
    const settledCount = updates.length
    await pause(60)
    assert.equal(updates.length, settledCount)
  })

  await check('取消后不再交付排队的流式更新', async () => {
    const controller = new AbortController()
    setStreamFactory(async function* () {
      yield chunk('{')
      yield chunk('"changes":[')
      controller.abort()
      await pause(60)
      throw new Error('合成取消')
    })
    const updates: unknown[] = []
    await assert.rejects(runJdVariantParse('合成 JD', (update: unknown) => updates.push(update), { throttleMs: 25, abortController: controller }), /合成取消/)
    assert.equal(updates.length, 1)
  })
}
finally {
  console.error = originalError
  await server.close()
}

if (failures > 0)
  process.exitCode = 1
