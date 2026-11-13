import type { AiMessage, AiMessagePart } from '../types'
import type { AgentUIMessage } from './to-message-parts'
import type { AgentTool } from './tool-registry'
import { createDeepSeek } from '@ai-sdk/deepseek'
import {
  createUIMessageStream,
  jsonSchema,
  readUIMessageStream,
  stepCountIs,
  tool,
  ToolLoopAgent,
} from 'ai'
import { getSkillReferences } from '../skills/references'
import { buildSkillCatalogContext, createSkillRuntime } from '../skills/runtime'
import { serializeAiToolValue } from './serialize-tool-value'
import { getToolResultState, toMessageParts } from './to-message-parts'
import { toModelMessages } from './to-model-messages'
import { getTools } from './tool-registry'

export interface AgentUsage {
  input: number
  output: number
  total: number
}

export interface AgentRunOptions {
  history: AiMessage[]
  signal: AbortSignal
  thinking?: boolean
  maxSteps?: number
  context?: string
  callbacks?: {
    onParts?: (parts: AiMessagePart[]) => void
    onUsage?: (usage: AgentUsage) => void
  }
}

export interface AgentDependencies {
  request?: (
    request: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<Response>
  tools?: AgentTool[]
  skillLoaders?: Parameters<typeof createSkillRuntime>[0]['loaders']
}

export async function runAgent(
  options: AgentRunOptions,
  dependencies: AgentDependencies = {},
): Promise<AiMessagePart[]> {
  const {
    history,
    signal,
    thinking = false,
    maxSteps = 12,
    context,
    callbacks = {},
  } = options

  const usage: AgentUsage = { input: 0, output: 0, total: 0 }

  const completedTools = new Map<
    string,
    Extract<AiMessagePart, { type: 'tool-call' }>
  >()

  let toolQueue: Promise<unknown> = Promise.resolve()
  let step = 0
  let failure: unknown
  let requestFailure: unknown
  let reachedStepLimit = false
  let finalParts: AiMessagePart[] = []

  const onError = (error: unknown) => {
    failure ??= error

    return error instanceof Error ? error.message : '回复失败'
  }

  const stream = createUIMessageStream<AgentUIMessage>({
    onError,
    execute: async ({ writer }) => {
      signal.throwIfAborted()

      const skillRuntime = createSkillRuntime({
        signal,
        loaders: dependencies.skillLoaders,
        onActivity: (activity) => {
          writer.write({
            type: 'data-skill-activity',
            id: activity.id,
            data: activity,
          })
        },
      })

      const lastUser = [...history]
        .reverse()
        .find((message) => message.role === 'user')

      const skillContext = await skillRuntime.loadExplicit(
        lastUser ? getSkillReferences(lastUser.parts) : [],
      )

      const tools = [
        ...(dependencies.tools ?? getTools()),
        ...skillRuntime.tools,
      ]

      // 页面只有一个写入确认位；串行执行也保留原工具之间的读写顺序。
      const sdkTools = Object.fromEntries(
        tools.map((definition) => {
          return [
            definition.name,
            tool({
              description: definition.description,
              inputSchema: jsonSchema<Record<string, unknown>>(
                definition.parameters,
              ),
              execute: (input, { toolCallId }) => {
                const execution = toolQueue.then(async () => {
                  signal.throwIfAborted()

                  if (definition.mode === 'write') {
                    writer.write({
                      type: 'data-tool-start',
                      id: toolCallId,
                      data: { toolCallId },
                    })
                  }

                  let output: unknown

                  try {
                    output = await definition.execute(input, { signal })
                  } catch (error) {
                    output = {
                      error:
                        error instanceof Error ? error.message : '工具执行失败',
                    }
                  }

                  completedTools.set(toolCallId, {
                    type: 'tool-call',
                    toolCallId,
                    toolName: definition.name,
                    step,
                    args: input,
                    result: output,
                    state: getToolResultState(output),
                  })

                  return output
                })

                toolQueue = execution.catch(() => undefined)

                return execution
              },
              toModelOutput: ({ output }) => ({
                type: 'text',
                value: serializeAiToolValue(output),
              }),
            }),
          ]
        }),
      )

      const request =
        dependencies.request ?? (await import('../../llm/call')).requestLLM

      const provider = createDeepSeek({
        // 真正鉴权由 requestLLM 交给现有代理；浏览器不持有模型密钥。
        apiKey: 'handled-by-llm-proxy',
        fetch: async (_url, init) => {
          try {
            return await request(
              JSON.parse(init?.body as string),
              init?.signal ?? signal,
            )
          } catch (error) {
            requestFailure = error

            throw error
          }
        },
      })

      const agent = new ToolLoopAgent({
        model: provider('deepseek-v4-pro'),
        tools: sdkTools,
        stopWhen: stepCountIs(maxSteps),
        maxRetries: 0,
        ...(!thinking ? { temperature: 0 } : {}),
        providerOptions: {
          deepseek: { thinking: { type: thinking ? 'enabled' : 'disabled' } },
        },
        onStepFinish: ({ usage: stepUsage }) => {
          step++
          usage.input += stepUsage.inputTokens ?? 0
          usage.output += stepUsage.outputTokens ?? 0
          usage.total += stepUsage.totalTokens ?? 0
          callbacks.onUsage?.({ ...usage })
        },
        onFinish: ({ steps, finishReason }) => {
          reachedStepLimit =
            steps.length >= maxSteps && finishReason === 'tool-calls'
        },
      })

      const result = await agent.stream({
        messages: toModelMessages(
          history,
          [context, buildSkillCatalogContext(), skillContext]
            .filter(Boolean)
            .join('\n\n'),
        ),
        abortSignal: signal,
      })

      writer.merge(
        result.toUIMessageStream({
          sendReasoning: true,
          // SDK 同样用此回调格式化工具错误；工具失败由模型继续处理。
          onError: (error) =>
            error instanceof Error ? error.message : '回复失败',
        }),
      )
    },
  })

  for await (const message of readUIMessageStream<AgentUIMessage>({
    stream,
    onError: (error) => onError(requestFailure ?? error),
  })) {
    finalParts = toMessageParts(message)
    callbacks.onParts?.(finalParts)
  }

  if (signal.aborted) {
    // SDK 取消会关闭输出流，但已确认的数据库写入仍可能完成；先保留真实结果再落库。
    await toolQueue

    const observedTools = new Set<string>()

    finalParts = finalParts.map((part) => {
      if (part.type !== 'tool-call') return part

      observedTools.add(part.toolCallId)

      return completedTools.get(part.toolCallId) ?? part
    })

    for (const [id, part] of completedTools) {
      if (!observedTools.has(id)) finalParts.push(part)
    }

    callbacks.onParts?.(finalParts)
  }

  signal.throwIfAborted()

  if (failure) throw failure
  if (reachedStepLimit) {
    finalParts.push({
      type: 'text',
      text: '（已达到工具调用步数上限，以上为当前进展）',
    })

    callbacks.onParts?.(finalParts)
  }

  return finalParts
}
