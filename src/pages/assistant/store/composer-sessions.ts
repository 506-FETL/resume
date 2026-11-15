import { z } from 'zod'
import { userReferenceSchema } from '@/lib/ai/references'
import type { StoreApi } from 'zustand'
import type { AssistantStore } from '../store'
import type { ComposerSlice } from './composer-slice'
import useUserStore from '@/store/user'

type Draft = Pick<
  ComposerSlice,
  | 'composerDraft'
  | 'composerReferences'
  | 'composerSkillIds'
  | 'composerLibrarySources'
  | 'queuedMessages'
  | 'pendingAssistantWrite'
  | 'pendingMessageUpdates'
>

const memoryDrafts = new Map<string, Draft>()
const failedDrafts = new Set<string>()

let accountGeneration = 0

export const getAssistantAccountGeneration = () => accountGeneration

const recoveryEpochs = new Map<string, number>()

export const getDraftRecoveryEpoch = (ownerId: string) =>
  recoveryEpochs.get(ownerId) ?? 0

const sourceRelationSchema = z.object({
  sourceId: z.string().uuid(),
  versionId: z.string().uuid(),
  name: z.string(),
  currentVersionId: z.string().uuid().nullable(),
  updatedAt: z.string(),
})

const pendingMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.literal('assistant'),
  createdAt: z.string(),
  parts: z.array(
    z.union([
      userReferenceSchema,
      z.object({
        type: z.literal('source-scope'),
        sources: z.array(sourceRelationSchema),
        targetResumeId: z.string().nullable().optional(),
      }),
      z.object({ type: z.literal('text'), text: z.string() }),
      z.object({ type: z.literal('reasoning'), text: z.string() }),
      z.object({
        type: z.literal('revision'),
        proposalId: z.string(),
        feedback: z.string(),
      }),
      z.object({
        type: z.literal('skill-activity'),
        id: z.string(),
        skillId: z.string(),
        version: z.string(),
        displayName: z.string(),
        state: z.enum(['loading', 'ready', 'error']),
        error: z.string().optional(),
      }),
      z.object({
        type: z.literal('tool-call'),
        toolCallId: z.string(),
        toolName: z.string(),
        targetResumeId: z.string().nullable().optional(),
        step: z.number().optional(),
        args: z.unknown(),
        result: z.unknown().optional(),
        state: z.enum([
          'call',
          'awaiting-confirm',
          'result',
          'error',
          'cancelled',
        ]),
        undone: z.boolean().optional(),
      }),
    ]),
  ),
})

const draftSchema = z.object({
  composerDraft: z.string(),
  composerReferences: z.array(userReferenceSchema),
  composerSkillIds: z.array(z.string()).default([]),
  composerLibrarySources: z
    .array(sourceRelationSchema)
    .nullable()
    .default(null),
  queuedMessages: z.array(
    z.object({
      id: z.string().uuid(),
      conversationId: z.string().nullable(),
      ownerId: z.string().uuid(),
      text: z.string(),
      references: z.array(userReferenceSchema),
      thinking: z.boolean(),
      createdAt: z.string(),
      targetResumeId: z.string().nullable().default(null),
      sources: z.array(sourceRelationSchema).optional(),
      proposalId: z.string().optional(),
      status: z.literal('unknown').optional(),
    }),
  ),
  pendingAssistantWrite: pendingMessageSchema.nullable().default(null),
  pendingMessageUpdates: z.array(pendingMessageSchema).default([]),
})

const emptyDraft = (): Draft => ({
  composerDraft: '',
  composerReferences: [],
  composerSkillIds: [],
  composerLibrarySources: null,
  queuedMessages: [],
  pendingAssistantWrite: null,
  pendingMessageUpdates: [],
})

function readDraft(key: string | null): Draft {
  if (!key) return emptyDraft()

  const memory = memoryDrafts.get(key)

  if (memory) return memory

  try {
    const raw = sessionStorage.getItem(key)
    const parsed = raw ? draftSchema.safeParse(JSON.parse(raw)) : null

    if (parsed?.success) {
      memoryDrafts.set(key, parsed.data)

      return parsed.data
    }
  } catch {}

  return emptyDraft()
}

function writeDraft(key: string | null, state: Draft) {
  if (!key) return

  const draft: Draft = {
    composerDraft: state.composerDraft,
    composerReferences: state.composerReferences,
    composerSkillIds: state.composerSkillIds,
    composerLibrarySources: state.composerLibrarySources,
    queuedMessages: state.queuedMessages,
    pendingAssistantWrite: state.pendingAssistantWrite,
    pendingMessageUpdates: state.pendingMessageUpdates,
  }

  memoryDrafts.set(key, draft)

  try {
    sessionStorage.setItem(key, JSON.stringify(draft))
    failedDrafts.delete(key)
  } catch {
    failedDrafts.add(key)
  }
}

export function updateConversationDraft(
  store: StoreApi<AssistantStore>,
  ownerId: string,
  conversationId: string,
  update: (draft: Draft) => Partial<Draft>,
  recoveryEpoch: number,
) {
  if (getDraftRecoveryEpoch(ownerId) !== recoveryEpoch) return

  if (
    useUserStore.getState().currentUser?.id === ownerId &&
    store.getState().activeConversationId === conversationId
  ) {
    store.setState({ ...update(store.getState()), queuePaused: true })

    return
  }

  const key = `assistant-draft-v1:${ownerId}:${conversationId}`
  const draft = readDraft(key)

  writeDraft(key, { ...draft, ...update(draft) })
}

export function installComposerSessions(store: StoreApi<AssistantStore>) {
  let owner = useUserStore.getState().currentUser?.id ?? null
  let updating = false

  const keyFor = (conversationId: string | null) =>
    owner ? `assistant-draft-v1:${owner}:${conversationId ?? 'new'}` : null

  store.setState({
    ...readDraft(keyFor(store.getState().activeConversationId)),
    queuePaused: true,
    draftStorageFailed: failedDrafts.has(
      keyFor(store.getState().activeConversationId) ?? '',
    ),
  })

  store.subscribe((state, previous) => {
    if (updating) return

    const changed = state.activeConversationId !== previous.activeConversationId

    if (changed) {
      writeDraft(keyFor(previous.activeConversationId), previous)
      updating = true

      // 首次发送创建了会话；同一草稿和排队项随新会话转移。
      if (
        previous.activeConversationId === null &&
        state.streaming &&
        state.abortController
      ) {
        store.setState({
          queuedMessages: state.queuedMessages.map((item) => ({
            ...item,
            conversationId: state.activeConversationId,
          })),
        })

        writeDraft(keyFor(null), emptyDraft())
      } else {
        store.setState({
          ...readDraft(keyFor(state.activeConversationId)),
          confirmationFeedback: '',
          queuePaused: true,
        })
      }

      updating = false
    }

    const key = keyFor(store.getState().activeConversationId)

    writeDraft(key, store.getState())

    const failed = Boolean(key && failedDrafts.has(key))

    if (store.getState().draftStorageFailed !== failed) {
      updating = true
      store.setState({ draftStorageFailed: failed })
      updating = false
    }
  })

  useUserStore.subscribe((state) => {
    const nextOwner = state.currentUser?.id ?? null

    if (nextOwner === owner) return

    accountGeneration++

    if (owner && !nextOwner && state.authStatus === 'anonymous') {
      recoveryEpochs.set(owner, getDraftRecoveryEpoch(owner) + 1)

      const prefix = `assistant-draft-v1:${owner}:`

      for (const key of memoryDrafts.keys()) {
        if (!key.startsWith(prefix)) continue

        memoryDrafts.delete(key)
        failedDrafts.delete(key)
      }

      try {
        const keys = Object.keys(sessionStorage).filter((key) =>
          key.startsWith(prefix),
        )

        for (const key of keys) sessionStorage.removeItem(key)
      } catch {}
    } else
      writeDraft(
        keyFor(store.getState().activeConversationId),
        store.getState(),
      )

    owner = nextOwner
    updating = true

    const current = store.getState()

    current.pendingConfirm?.resolve({ kind: 'reject' })
    current.abortController?.abort()

    store.setState({
      ...readDraft(keyFor(null)),
      draftStorageFailed: failedDrafts.has(keyFor(null) ?? ''),
      activeConversationId: null,
      conversationViewVersion: current.conversationViewVersion + 1,
      streaming: false,
      abortController: null,
      pendingConfirm: null,
      runPhase: current.abortController ? 'settling' : 'idle',
      confirmationFeedback: '',
      annotationTarget: null,
      explicitPreviewResumeId: null,
      sourceViewer: null,
      queuePaused: true,
    })

    updating = false
  })
}
