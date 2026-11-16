import { mergePendingCreationsIntoThreads } from '../pending-creations.ts'
import {
  indexCommentThreadReadStates,
  mergeCommentThreadReadStateMaps,
} from '../read-state.ts'
import type { ResumeCommentStore, ResumeCommentStoreState } from '../types.ts'
import { orderThreads } from './order-threads'

export function createScopeActions(
  set: ResumeCommentStore['setState'],
): Pick<ResumeCommentStoreState, 'replaceScope' | 'beginScopeSwitch'> {
  return {
    replaceScope: (input) =>
      set((state) => {
        const scopeChanged = state.scope?.id !== input.scope.id

        const lastReadEventSeq = scopeChanged
          ? input.lastReadEventSeq
          : Math.max(state.lastReadEventSeq, input.lastReadEventSeq)

        const pendingCreationsByRequestId = scopeChanged
          ? {}
          : state.pendingCreationsByRequestId

        const threadsById = mergePendingCreationsIntoThreads(
          input.threads,
          state.threadsById,
          pendingCreationsByRequestId,
        )

        const liveThreadIds = new Set(Object.keys(threadsById))

        const incomingThreadReadStates = Object.fromEntries(
          Object.entries(
            indexCommentThreadReadStates(input.threadReadStates),
          ).filter(([threadId]) => liveThreadIds.has(threadId)),
        )

        const threadReadStateById = scopeChanged
          ? incomingThreadReadStates
          : mergeCommentThreadReadStateMaps(
              Object.fromEntries(
                Object.entries(state.threadReadStateById).filter(([threadId]) =>
                  liveThreadIds.has(threadId),
                ),
              ),
              incomingThreadReadStates,
            )

        const draftsByScopeId = state.scope
          ? {
              ...state.draftsByScopeId,
              [state.scope.id]: state.draftsByThreadKey,
            }
          : state.draftsByScopeId

        return {
          scope: input.scope,
          scopeEpoch: scopeChanged ? state.scopeEpoch + 1 : state.scopeEpoch,
          version: input.version,
          counts: input.counts,
          accessibleScopes: input.accessibleScopes.map((scope) =>
            scope.id === input.scope.id
              ? {
                  ...scope,
                  lastReadEventSeq: Math.max(
                    scope.lastReadEventSeq,
                    lastReadEventSeq,
                  ),
                }
              : scope,
          ),
          threadsById,
          orderedThreadIds: orderThreads(
            Object.values(threadsById),
            input.scope,
          ),
          events: input.events ?? [],
          activeThreadId: scopeChanged ? null : state.activeThreadId,
          hoveredThreadId: scopeChanged ? null : state.hoveredThreadId,
          selection: scopeChanged ? null : state.selection,
          draftsByScopeId,
          // 草稿按 scope 隔离保存；stale release 切换时允许显式携带当前草稿。
          draftsByThreadKey: scopeChanged
            ? state.preserveDraftsOnNextScope
              ? state.draftsByThreadKey
              : (draftsByScopeId[input.scope.id] ?? {})
            : state.draftsByThreadKey,
          preserveDraftsOnNextScope: false,
          relinkThreadId: scopeChanged ? null : state.relinkThreadId,
          relinkError: scopeChanged ? null : state.relinkError,
          lastEventSeq: input.eventSeq,
          // 同一 scope 的已读游标只能前进，避免较旧缓存或并发 bootstrap
          // 把刚刚在界面里确认过的已读状态回滚成“有新评论”。
          lastReadEventSeq,
          threadReadStateById,
          lastError: null,
          pendingEntities: {},
          pendingCreationsByRequestId,
          commentRenderKeys: scopeChanged ? {} : state.commentRenderKeys,
          mutationErrors: {},
          contentNotice: null,
        }
      }),
    beginScopeSwitch: () =>
      set((state) => ({
        scope: null,
        scopeEpoch: state.scopeEpoch + 1,
        version: null,
        counts: { unresolved: 0, resolved: 0, detached: 0 },
        threadsById: {},
        orderedThreadIds: [],
        events: [],
        activeThreadId: null,
        hoveredThreadId: null,
        selection: null,
        draftsByScopeId: state.scope
          ? {
              ...state.draftsByScopeId,
              [state.scope.id]: state.draftsByThreadKey,
            }
          : state.draftsByScopeId,
        draftsByThreadKey: state.preserveDraftsOnNextScope
          ? state.draftsByThreadKey
          : {},
        relinkThreadId: null,
        relinkError: null,
        lastEventSeq: 0,
        lastReadEventSeq: 0,
        threadReadStateById: {},
        connection: 'connecting',
        pendingEntities: {},
        pendingCreationsByRequestId: {},
        commentRenderKeys: {},
        mutationErrors: {},
        contentNotice: null,
      })),
  }
}
