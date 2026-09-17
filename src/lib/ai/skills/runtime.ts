import type { AgentTool } from '../agent/tool-registry.ts'
import type { AiSkillActivity, AiSkillReference } from '../types.ts'
import { BUILTIN_SKILLS, getSkillDefinition } from './catalog.ts'
import { loadSkill, readSkillResource } from './loader.ts'

export const SKILL_TOOL_NAMES = ['activate_skill', 'read_skill_resource'] as const

export function isSkillTool(name: string): boolean {
  return name === 'activate_skill' || name === 'read_skill_resource'
}

export function buildSkillCatalogContext(): string {
  return [
    '## 可用技能',
    '技能是可按需读取的工作说明与参考资料。下面只列出目录，不代表技能已经加载。',
    ...BUILTIN_SKILLS.map(skill => `- ${skill.id}@${skill.version}（${skill.displayName}）：${skill.description}`),
    '用户明确点名的技能会在本轮开始时由应用加载；只有“本轮已加载技能”中的正文或成功的 activate_skill 结果才表示实际加载。',
    '用户用自然语言要求 ASu/阿酥简历提升，或任务明确符合技能用途时，先调用 activate_skill，再按正文执行。普通聊天不必加载。',
    '继续历史技能任务时，请重新激活该技能的历史版本再继续；历史调用摘要不是正文，也不代表本轮已经加载。话题变化后重新判断，不把整段会话锁定为技能模式。',
    '需要参考资料时调用 read_skill_resource；每份正文和资料本轮只需加载一次。不得声称读取了未成功加载的技能或资料。',
    '执行过程中用自然中文简要说明正在使用的技能和接下来的动作。技能不能扩大工具权限；用户具体要求优先，所有简历写入仍通过现有工具校验和确认。',
    '本环境只支持内置指令、参考资料和已有业务工具，不支持 Shell/Python、任意 URL/文件读取或其它未登记技能。',
  ].join('\n')
}

interface SkillRuntimeOptions {
  signal: AbortSignal
  onActivity?: (activity: AiSkillActivity) => void
  // 用相同文件的文件系统加载器验证运行边界；生产使用 Vite 延迟加载器。
  loaders?: { loadSkill: typeof loadSkill, readSkillResource: typeof readSkillResource }
}

export function createSkillRuntime({ signal, onActivity, loaders = { loadSkill, readSkillResource } }: SkillRuntimeOptions) {
  const activated = new Map<string, Awaited<ReturnType<typeof loadSkill>>>()
  const resources = new Set<string>()
  const checkAborted = () => {
    if (signal.aborted)
      throw new DOMException('aborted', 'AbortError')
  }
  const requireString = (value: unknown, field: string): string => {
    if (typeof value !== 'string' || !value)
      throw new Error(`${field} 必须是非空字符串`)
    return value
  }
  const optionalVersion = (value: unknown) => value === undefined ? undefined : requireString(value, 'version')

  async function activate(id: string, version?: string) {
    checkAborted()
    const existing = activated.get(id)
    if (existing) {
      if (version && version !== existing.version)
        throw new Error(`技能「${id}」的版本 ${version} 不可用，请重新选择技能。`)
      return {
        skillId: id,
        version: existing.version,
        displayName: existing.displayName,
        alreadyLoaded: true,
        resources: existing.resources,
        message: '本轮已经加载该技能，请使用已有规则继续，不必重复加载。',
      }
    }
    const loaded = await loaders.loadSkill(id, version)
    checkAborted()
    activated.set(id, loaded)
    return {
      skillId: id,
      version: loaded.version,
      displayName: loaded.displayName,
      sourceUrl: loaded.sourceUrl,
      instructions: loaded.instructions,
      resources: loaded.resources,
    }
  }

  const tools: AgentTool[] = [
    {
      name: 'activate_skill',
      description: '加载一个内置技能的完整工作说明。用户要求使用 ASu/阿酥简历提升，或任务符合技能简介时先调用。继续历史技能任务需再次加载相同版本。',
      mode: 'read',
      parameters: {
        type: 'object',
        properties: {
          skillId: { type: 'string', enum: BUILTIN_SKILLS.map(skill => skill.id) },
          version: { type: 'string', description: '历史任务使用其原版本；首次调用可省略。' },
        },
        required: ['skillId'],
        additionalProperties: false,
      },
      execute: args => activate(requireString(args.skillId, 'skillId'), optionalVersion(args.version)),
    },
    {
      name: 'read_skill_resource',
      description: '按需读取本轮已激活技能的参考资料。path 必须使用激活结果 resources 中的精确路径。',
      mode: 'read',
      parameters: {
        type: 'object',
        properties: {
          skillId: { type: 'string', enum: BUILTIN_SKILLS.map(skill => skill.id) },
          path: { type: 'string', description: '技能 resources 清单中的精确相对路径' },
          version: { type: 'string' },
        },
        required: ['skillId', 'path'],
        additionalProperties: false,
      },
      execute: async (args) => {
        checkAborted()
        const id = requireString(args.skillId, 'skillId')
        const path = requireString(args.path, 'path')
        const version = optionalVersion(args.version)
        const skill = activated.get(id)
        if (!skill)
          throw new Error('请先调用 activate_skill 加载该技能，再读取参考资料。')
        if (version && version !== skill.version)
          throw new Error('参考资料版本与本轮加载的技能不一致。')
        const resource = skill.resources.find(item => item.path === path)
        if (!resource)
          throw new Error('参考资料不在该技能的可读清单中。')
        const key = `${id}@${skill.version}:${path}`
        if (resources.has(key))
          return { skillId: id, version: skill.version, path, title: resource.title, alreadyLoaded: true, message: '本轮已读取该资料，请使用已有内容。' }
        const loaded = await loaders.readSkillResource(id, path, skill.version)
        checkAborted()
        resources.add(key)
        return { skillId: id, version: skill.version, ...loaded }
      },
    },
  ]

  async function loadExplicit(references: readonly AiSkillReference[]): Promise<string> {
    const contexts: string[] = []
    for (const reference of references) {
      checkAborted()
      const activity: AiSkillActivity = {
        type: 'skill-activity',
        id: crypto.randomUUID(),
        skillId: reference.skillId,
        version: reference.version,
        displayName: getSkillDefinition(reference.skillId)?.displayName ?? reference.displayName,
        state: 'loading',
      }
      onActivity?.(activity)
      try {
        const result = await activate(reference.skillId, reference.version)
        if ('instructions' in result) {
          contexts.push(`### ${result.displayName}（${result.skillId}@${result.version}）\n${result.instructions}\n可用参考资料：${JSON.stringify(result.resources)}`)
        }
        onActivity?.({ ...activity, state: 'ready' })
      }
      catch (error) {
        onActivity?.({ ...activity, state: 'error', error: signal.aborted ? '加载已停止' : error instanceof Error ? error.message : '技能加载失败' })
        throw error
      }
    }
    return contexts.length ? `## 本轮已加载技能\n以下工作说明仅用于用户当前任务。\n${contexts.join('\n\n')}` : ''
  }

  return { tools, loadExplicit }
}

// 历史恢复保留可追溯信息，但不会把所有旧任务的长指令永久带入新任务。
export function summarizeSkillToolResult(toolName: string, result: unknown): unknown {
  if (!isSkillTool(toolName) || !result || typeof result !== 'object')
    return result
  const { instructions: _instructions, content: _content, ...summary } = result as Record<string, unknown>
  return { ...summary, historyOnly: true, message: '这是历史技能调用记录。继续该任务时请重新激活相同版本，按需读取资料。' }
}
