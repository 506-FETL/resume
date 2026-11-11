import type { ImportDraft } from '@/lib/resume-preparation/types'
import { useCreationDraftStore } from '@/pages/resume/components/create-resume-card/store'
import { emptyDraft } from '@/pages/resume/components/create-resume-card/utils'
import { createProfileExample } from '@/lib/resume-preparation/profile-example'
import { parseResumeText } from '@/lib/resume-import/parse'
import { saveImportDraft } from '@/lib/resume-preparation/storage'
import { useResumeCreationStore } from '@/store/resume-creation'
import {
  insertCalls,
  savedSnapshots,
  simulateUnknownResult,
} from './persistence'
import { verifyPipeline } from './verify-pipeline'

export const importText =
  '姓名：林小明\n手机：13900000000\n邮箱：fixture@example.invalid\n求职意向：前端开发工程师\n教育经历\n2020.09-2024.06 明川大学 计算机科学 本科\n项目经历\n2025.01-2025.06 活动报名工具\n负责报名表单与列表筛选，核对字段和错误提示。'

export const selectedTemplate = {
  template: { templateId: 'default', templateVersion: 3 },
  example: { exampleId: 'graduate', version: 1 },
  name: '默认模板',
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

export async function verifyCreationFlow(create: () => Promise<void>) {
  const results = await verifyPipeline()
  const profile = createProfileExample('graduate')
  const parsed = parseResumeText(importText)

  for (const contentSource of ['profile', 'import'] as const) {
    const content = contentSource === 'profile' ? profile : parsed.content
    const before = savedSnapshots.length

    useCreationDraftStore.setState({
      scope: 'guest',
      ready: true,
      draft: {
        ...emptyDraft(),
        content,
        contentSource,
        selectedTemplate,
        displayName: '   ',
        description: '  前端岗位投递说明  ',
        sourceText: contentSource === 'import' ? importText : '',
      },
    })

    await create()

    const saved = savedSnapshots.at(-1)

    assert(
      savedSnapshots.length === before + 1 && saved,
      `${contentSource} 未经过真实创建流水线`,
    )

    assert(
      saved.displayName === '示例简历',
      `${contentSource} 空白名称未使用示例简历`,
    )

    assert(
      saved.description === '前端岗位投递说明',
      `${contentSource} 描述没有保存`,
    )

    assert(
      saved.snapshot.basics.name === content.basics.name,
      `${contentSource} 正文不应被模板示例替换`,
    )

    if (contentSource === 'import')
      assert(
        !JSON.stringify(saved.snapshot).includes('知行大学'),
        '导入正文混入了从零示例',
      )

    results.push(
      `${contentSource === 'profile' ? '从零' : '导入'}：空白名称兜底、描述保存、正文来源正确`,
    )
  }

  useCreationDraftStore.setState({
    scope: 'guest',
    ready: true,
    draft: {
      ...emptyDraft(),
      content: profile,
      contentSource: 'profile',
      selectedTemplate,
      displayName: '  首次名称  ',
      description: '  首次描述  ',
    },
  })

  simulateUnknownResult()
  await create()

  const operation = useCreationDraftStore.getState().draft.creation
  const inserted = insertCalls

  assert(
    operation?.displayName === '首次名称' &&
      operation.description === '首次描述',
    '创建快照必须冻结两项信息',
  )

  assert(
    useResumeCreationStore.getState().status === 'uncertain',
    '响应丢失必须可确认',
  )

  useCreationDraftStore
    .getState()
    .patch({ displayName: '后改名称', description: '后改描述' })

  await create()
  assert(insertCalls === inserted, 'flow 重试不得重复创建')

  assert(
    savedSnapshots.at(-1)?.operationId === operation.operationId,
    '重试必须保留操作 ID',
  )

  assert(
    savedSnapshots.at(-1)?.description === '首次描述',
    '重试必须保留冻结描述',
  )

  results.push('真实 flow：结果未知重试沿用原操作与冻结信息')

  const oldDraft = {
    ...emptyDraft(),
    displayName: undefined,
    description: undefined,
    creation: {
      operationId: crypto.randomUUID(),
      mode: 'local',
      displayName: '旧草稿名称',
      selection: selectedTemplate,
    },
  } as unknown as ImportDraft

  await saveImportDraft('guest', oldDraft)
  useCreationDraftStore.setState({ scope: null, ready: false })
  await useCreationDraftStore.getState().load('guest')

  assert(
    useCreationDraftStore.getState().draft.displayName === '旧草稿名称',
    '旧草稿应保留原名称',
  )

  assert(
    useCreationDraftStore.getState().draft.description === '',
    '旧草稿缺描述应补空字符串',
  )

  await saveImportDraft('guest', {
    ...emptyDraft(),
    displayName: '',
    description: '',
  })

  useCreationDraftStore.setState({ scope: null, ready: false })
  await useCreationDraftStore.getState().load('guest')

  assert(
    useCreationDraftStore.getState().draft.displayName === '',
    '明确清空的输入不得重新填默认值',
  )

  await useCreationDraftStore.getState().discard()
  results.push('旧草稿名称兼容与显式空字符串保留')

  return results
}
