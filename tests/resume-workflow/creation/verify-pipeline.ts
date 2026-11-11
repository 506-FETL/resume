import type { TemplateSource } from '@/lib/resume-template/source/types'
import type {
  CreatedTemplateResume,
  PreparedResumeCreation,
  ResumeCreationPersistence,
} from '@/lib/resume-template/create/types'
import { parseTemplateDefinition } from '@/lib/resume-template/definition-schema'
import { decodeResource } from '@/lib/resume-template/source/resource-schema'
import { createdResumeResult } from '@/lib/resume-template/create/prepare'
import { createResumeCreationStore } from '@/store/resume-creation/create-store'
import { createProfileExample } from '@/lib/resume-preparation/profile-example'
import resource from './template-resource.json'

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

export async function verifyPipeline() {
  const definition = parseTemplateDefinition(await decodeResource(resource))
  const records = new Map<string, CreatedTemplateResume>()
  const snapshots: PreparedResumeCreation[] = []
  let failLookup = false
  let responseLost = true
  let owner = '11111111-1111-4111-8111-111111111111'
  let insertCount = 0

  const source = {
    getTemplateVersion: async () => definition,
    getExample: async () => {
      throw new Error('导入或示例正文已提供，不应另取模板示例')
    },
  } as unknown as TemplateSource

  const persistence: ResumeCreationPersistence = {
    find: async (prepared) => {
      if (failLookup) {
        failLookup = false

        throw new Error('模拟确认结果失败')
      }

      return records.get(prepared.resumeId) ?? null
    },
    insert: async (prepared) => {
      insertCount += 1
      snapshots.push(structuredClone(prepared))

      const result = createdResumeResult(prepared, {
        resume_id: prepared.resumeId,
        display_name: prepared.displayName,
        description: prepared.description,
        created_at: '2026-11-11T00:00:00Z',
      })

      records.set(prepared.resumeId, result)

      if (responseLost) {
        responseLost = false
        failLookup = true

        throw new Error('模拟已保存但响应丢失')
      }

      return result
    },
  }

  const store = createResumeCreationStore({
    source,
    persistence,
    getOwnerId: () => owner,
  })

  const input = {
    template: { templateId: 'default', templateVersion: 3 },
    example: { exampleId: 'graduate', version: 1 },
    mode: 'cloud' as const,
    operationId: crypto.randomUUID(),
    displayName: '  示例简历  ',
    description: '  用于前端岗位投递  ',
    content: createProfileExample('graduate'),
  }

  await store
    .getState()
    .start(input)
    .catch(() => undefined)

  assert(store.getState().status === 'uncertain', '响应丢失必须保留未确认状态')

  assert(
    snapshots[0].displayName === '示例简历',
    '准备流程必须移除名称首尾空白',
  )

  assert(
    snapshots[0].description === '用于前端岗位投递',
    '描述必须真实进入持久化边界',
  )

  input.displayName = '后来的名称'
  input.description = '后来的描述'
  input.content.basics.name = '后来修改的正文'

  const retried = await store.getState().start(input)

  assert(insertCount === 1 && records.size === 1, '重试不得第二次插入')

  assert(
    retried.displayName === '示例简历' &&
      retried.description === '用于前端岗位投递',
    '重试应使用原冻结信息',
  )

  assert(
    snapshots[0].snapshot.basics.name === '示例用户',
    '请求必须冻结正文副本',
  )

  assert(
    snapshots[0].snapshot.templateBinding?.templateVersion === 3,
    '必须保留精确模板版本',
  )

  const nextInput = { ...input, operationId: crypto.randomUUID() }
  const pending = store.getState().start(nextInput)

  owner = '22222222-2222-4222-8222-222222222222'
  await pending.catch(() => undefined)
  assert(insertCount === 1, '账号切换后旧请求不得开始写入')

  owner = '11111111-1111-4111-8111-111111111111'
  await store.getState().start(nextInput)
  assert(Number(insertCount) === 2, '返回原账号可继续同一操作')

  return [
    '真实资源解码与精确版本',
    '名称和描述进入持久化边界',
    '正文与信息冻结',
    '结果未知重试仅插入一次',
    '账户 A→B→A 隔离',
  ]
}
