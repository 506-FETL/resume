import { createDeepSeek } from '@ai-sdk/deepseek'
import type { ModelMessage } from 'ai'
import {
  createUIMessageStream,
  jsonSchema,
  readUIMessageStream,
  stepCountIs,
  tool,
  ToolLoopAgent,
} from 'ai'
import { getSkillReferences } from '../../skills/references'
import {
  buildSkillCatalogContext,
  createSkillRuntime,
} from '../../skills/runtime'
import type { AiContextUsage, AiMessagePart } from '../../types'
import {
  ASSISTANT_MODEL,
  createContextTokenCounter,
  estimateContextTokens,
  MODEL_CONTEXT_LIMITS,
} from '../context-budget'
import { createEvidenceTools } from '../evidence-tools'
import { serializeAiToolValue } from '../serialize-tool-value'
import { createStepContextCompactor } from '../step-context'
import type { AgentUIMessage } from '../to-message-parts'
import { getToolResultState, toMessageParts } from '../to-message-parts'
import { toModelMessages } from '../to-model-messages'
import { getTools } from '../tool-registry'
import type { AgentDependencies, AgentRunOptions, AgentUsage } from './types'

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
  const counter = createContextTokenCounter()
  let lastStepMessages: ModelMessage[] = []
  let lastRequestInput: unknown
  let contextUsage: AiContextUsage | undefined

  const reportContext = (
    inputTokens: number,
    estimated: boolean,
    outputTokens?: number,
    reasoningTokens?: number,
  ) => {
    contextUsage = {
      type: 'context-usage',
      targetResumeId: options.target?.resumeId,
      inputTokens,
      outputTokens,
      reasoningTokens,
      estimated,
      model: ASSISTANT_MODEL,
      sourceFingerprint: JSON.stringify(
        (options.sources ?? [])
          .map((source) => [source.sourceId, source.versionId])
          .sort(),
      ),
    }

    callbacks.onContextUsage?.(contextUsage)
  }

  const completedTools = new Map<
    string,
    Extract<AiMessagePart, { type: 'tool-call' }>
  >()

  const toolTargets = new Map<string, string | null>()

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
        ...(dependencies.tools
          ? []
          : createEvidenceTools(options.sources ?? [])),
        ...skillRuntime.tools,
      ]

      // 页面只有一个写入确认位；串行执行也保留原工具之间的读写顺序。
      const sdkTools = Object.fromEntries(
        tools.map((definition) => {
          return [
            definition.name,
            tool({
              description: `${definition.description}\n作用范围：${definition.policy.scope}；${definition.policy.confirmation === 'required' ? '必须经本轮界面的明确确认后写入。' : '无需写入确认，但不能扩大已授权的读取范围。'}`,
              inputSchema: jsonSchema<Record<string, unknown>>(
                definition.parameters,
              ),
              execute: (input, { toolCallId }) => {
                const execution = toolQueue.then(async () => {
                  signal.throwIfAborted()

                  const targetResumeId = options.target?.resumeId ?? null

                  toolTargets.set(toolCallId, targetResumeId)

                  if (definition.policy.confirmation === 'required') {
                    writer.write({
                      type: 'data-tool-start',
                      id: toolCallId,
                      data: { toolCallId },
                    })
                  }

                  let output: unknown

                  try {
                    output = await definition.execute(input, {
                      signal,
                      target: options.target,
                    })
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
                    targetResumeId,
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
        dependencies.request ?? (await import('../../../llm/call')).requestLLM

      const provider = createDeepSeek({
        // 真正鉴权由 requestLLM 交给现有代理；浏览器不持有模型密钥。
        apiKey: 'handled-by-llm-proxy',
        fetch: async (_url, init) => {
          try {
            const payload = JSON.parse(init?.body as string)

            if (
              new TextEncoder().encode(JSON.stringify(payload)).byteLength >
                MODEL_CONTEXT_LIMITS.requestBytes ||
              payload.messages.length > MODEL_CONTEXT_LIMITS.requestMessages
            )
              throw new Error(
                '本轮完整请求超过处理范围，请缩小材料范围。原记录已保留。',
              )

            lastRequestInput = {
              messages: payload.messages,
              tools: payload.tools,
            }

            reportContext(estimateContextTokens(lastRequestInput), true)

            return await request(payload, init?.signal ?? signal)
          } catch (error) {
            requestFailure = error

            throw error
          }
        },
      })

      const compactStep = createStepContextCompactor(
        signal,
        {
          onCompaction: callbacks.onCompaction,
          skipCompaction: options.skipCompaction,
        },
        counter,
      )

      const agent = new ToolLoopAgent({
        model: provider(ASSISTANT_MODEL),
        tools: sdkTools,
        stopWhen: stepCountIs(maxSteps),
        maxRetries: 0,
        maxOutputTokens: MODEL_CONTEXT_LIMITS.outputTokens,
        prepareStep: async (stepOptions) => {
          const prepared = await compactStep(stepOptions)

          lastStepMessages = prepared.messages

          return prepared
        },
        ...(!thinking ? { temperature: 0 } : {}),
        providerOptions: {
          deepseek: { thinking: { type: thinking ? 'enabled' : 'disabled' } },
        },
        onStepFinish: ({ usage: stepUsage }) => {
          const inputTokens =
            typeof stepUsage.raw?.prompt_tokens === 'number'
              ? stepUsage.inputTokens
              : undefined

          const outputTokens =
            typeof stepUsage.raw?.completion_tokens === 'number'
              ? stepUsage.outputTokens
              : undefined

          const details = stepUsage.raw?.completion_tokens_details

          // DeepSeek SDK 会把缺失的推理用量补为 0，只有上游确实返回时才展示。
          const reasoningTokens =
            details &&
            typeof details === 'object' &&
            !Array.isArray(details) &&
            typeof details.reasoning_tokens === 'number'
              ? stepUsage.outputTokenDetails.reasoningTokens
              : undefined

          if (inputTokens != null)
            counter.observe(lastStepMessages, inputTokens, lastRequestInput)

          const reportedInput = inputTokens ?? contextUsage?.inputTokens

          if (reportedInput != null)
            reportContext(
              reportedInput,
              inputTokens == null,
              outputTokens,
              reasoningTokens,
            )

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
          {
            instructions: [
              context?.instructions,
              buildSkillCatalogContext(),
              skillContext,
            ]
              .filter(Boolean)
              .join('\n\n'),
            data: context?.data,
          },
          options.summary,
          options.sources ?? [],
          options.target?.resumeId,
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
    finalParts = toMessageParts(message).map((part) =>
      part.type === 'tool-call' && toolTargets.has(part.toolCallId)
        ? { ...part, targetResumeId: toolTargets.get(part.toolCallId)! }
        : part,
    )

    if (contextUsage) finalParts.push(contextUsage)

    callbacks.onParts?.(finalParts)
  }

  if (contextUsage) {
    finalParts = [
      ...finalParts.filter((part) => part.type !== 'context-usage'),
      contextUsage,
    ]
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
