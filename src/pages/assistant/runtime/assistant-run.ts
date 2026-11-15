import type { ContextCompactionEvent } from '@/lib/ai/agent/context-events'
import type { AssistantRunPhase } from '../store/composer-slice'
import { createSequentialRunner } from './sequential-runner'

export interface AssistantRunIdentity {
  ownerId: string
  recoveryEpoch: number
  accountGeneration: number
  conversationId: string | null
  submissionId: string
  targetResumeId: string | null
  toolName?: string
}

export interface AssistantRun extends AssistantRunIdentity {
  runId: string
  controller: AbortController
  completion: Promise<unknown>
  startedAt: number
}

export interface AssistantRunEvent {
  runId: string
  phase: AssistantRunPhase | 'complete' | 'paused' | 'interrupted' | 'failed'
  elapsedMs: number
  toolName?: string
  identity?: AssistantRunIdentity
  compaction?: ContextCompactionEvent
  toolCallId?: string
  toolState?: string
}

export const assistantRunner = createSequentialRunner()

let currentRun: AssistantRun | null = null
const events: AssistantRunEvent[] = []

export const getAssistantRun = () => currentRun

export const getAssistantRunEvents = () => [...events]

export function recordAssistantRunPhase(phase: AssistantRunEvent['phase']) {
  if (!currentRun) return

  events.push({
    runId: currentRun.runId,
    phase,
    elapsedMs: Math.round(performance.now() - currentRun.startedAt),
    ...(currentRun.toolName ? { toolName: currentRun.toolName } : {}),
  })

  if (events.length > 200) events.splice(0, events.length - 200)
}

export function executeAssistantRun<T>(
  identity: AssistantRunIdentity,
  work: (run: AssistantRun) => Promise<T>,
): Promise<T> {
  const run: AssistantRun = {
    ...identity,
    runId: crypto.randomUUID(),
    controller: new AbortController(),
    completion: Promise.resolve(),
    startedAt: performance.now(),
  }

  currentRun = run

  events.push({
    runId: run.runId,
    phase: 'preparing',
    elapsedMs: 0,
    identity: { ...identity },
  })

  const completion = Promise.resolve()
    .then(() => work(run))
    .then((result) => {
      recordAssistantRunPhase(
        result === 'paused'
          ? 'paused'
          : result === 'interrupted'
            ? 'interrupted'
            : 'complete',
      )

      return result
    })
    .catch((error) => {
      recordAssistantRunPhase('failed')

      throw error
    })
    .finally(() => {
      if (currentRun === run) currentRun = null
    })

  run.completion = completion

  return completion
}

export function recordAssistantRunCompaction(event: ContextCompactionEvent) {
  if (!currentRun) return

  events.push({
    runId: currentRun.runId,
    phase: 'compacting',
    elapsedMs: Math.round(performance.now() - currentRun.startedAt),
    compaction: event,
  })

  if (events.length > 200) events.splice(0, events.length - 200)
}

export function recordAssistantRunToolResult(event: {
  toolName: string
  state: string
  toolCallId: string
}) {
  if (!currentRun) return

  events.push({
    runId: currentRun.runId,
    phase: 'generating',
    elapsedMs: Math.round(performance.now() - currentRun.startedAt),
    toolName: event.toolName,
    toolCallId: event.toolCallId,
    toolState: event.state,
  })

  if (events.length > 200) events.splice(0, events.length - 200)
}
