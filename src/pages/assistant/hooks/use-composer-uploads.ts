import { useCallback, useEffect, useRef, useState } from 'react'
import { uniqueReferences } from '@/lib/ai/references'
import { persistExperienceUpload } from '@/lib/experience-sources/upload'
import { ExperienceSourceError } from '@/lib/experience-sources/types'
import type { ExtractedExperienceFile } from '@/lib/experience-sources/types'
import { createConversation } from '@/lib/supabase/ai'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import useUserStore from '@/store/user'
import { DEFAULT_CONVERSATION_TITLE } from '../const'
import useAssistantStore from '../store'
import {
  getDraftRecoveryEpoch,
  reserveNewConversationDraft,
  updateConversationDraft,
} from '../store/composer-sessions'
import { writeLastConversationId } from '../utils'

type UploadConversation = {
  conversationId: string
  ownerId: string
  generation: number
  view: number
  recoveryEpoch: number
  persisted: boolean
  request?: Promise<void>
  controller?: AbortController
}

type UploadTask = {
  operationId: string
  file: File
  extracted?: ExtractedExperienceFile
  target: UploadConversation
  status: 'preparing' | 'reading' | 'saving' | 'failed' | 'unknown'
  error?: string
  controller: AbortController
}

export function useComposerUploads() {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const jobsRef = useRef(new Map<string, UploadTask>())
  const conversationsRef = useRef(new Map<string, UploadConversation>())
  const ownerId = useUserStore((state) => state.currentUser?.id)
  const view = useAssistantStore((state) => state.conversationViewVersion)

  const conversationId = useAssistantStore(
    (state) => state.activeConversationId,
  )

  const generation = useExperienceSourcesStore((state) => state.generation)

  const publish = useCallback(() => {
    const tasks = [...jobsRef.current.values()]

    setTasks(tasks)

    useAssistantStore.setState({
      composerUploadCount: tasks.filter(isCurrentUpload).length,
    })
  }, [])

  useEffect(() => {
    const unsubscribe = useAssistantStore.subscribe((state, previous) => {
      if (
        state.activeConversationId !== previous.activeConversationId ||
        state.conversationViewVersion !== previous.conversationViewVersion
      )
        publish()
    })

    publish()

    return unsubscribe
  }, [publish])

  useEffect(() => {
    publish()
  }, [ownerId, generation, publish])

  useEffect(
    () => () => {
      for (const task of jobsRef.current.values()) task.controller.abort()

      for (const target of conversationsRef.current.values())
        target.controller?.abort()

      useAssistantStore.setState({ composerUploadCount: 0 })
    },
    [],
  )

  async function ensureConversation(target: UploadConversation) {
    if (target.persisted) return
    if (target.request && !target.controller?.signal.aborted)
      return target.request

    const controller = new AbortController()

    target.controller = controller

    const unsubscribe = useExperienceSourcesStore.subscribe((state) => {
      if (state.generation !== target.generation) controller.abort()
    })

    const request = createConversation(DEFAULT_CONVERSATION_TITLE, {
      id: target.conversationId,
      ownerId: target.ownerId,
      signal: controller.signal,
    })
      .then((conversation) => {
        controller.signal.throwIfAborted()
        target.persisted = true

        const state = useAssistantStore.getState()

        state.upsertConversation(conversation)

        if (
          state.activeConversationId === null &&
          state.conversationViewVersion === target.view
        ) {
          useAssistantStore.setState({
            activeConversationId: conversation.id,
            queuedMessages: state.queuedMessages.map((item) => ({
              ...item,
              conversationId: conversation.id,
            })),
          })

          writeLastConversationId(conversation.id)
        } else {
          updateConversationDraft(
            useAssistantStore,
            target.ownerId,
            target.conversationId,
            (draft) => ({
              queuedMessages: draft.queuedMessages.map((item) => ({
                ...item,
                conversationId: target.conversationId,
              })),
            }),
            target.recoveryEpoch,
            { pauseQueue: false },
          )
        }
      })
      .finally(() => {
        unsubscribe()

        if (target.request === request) target.request = undefined
      })

    target.request = request

    return request
  }

  async function run(task: UploadTask) {
    task.status = task.target.persisted ? 'reading' : 'preparing'
    task.error = undefined
    task.controller = new AbortController()
    publish()

    const target = task.target

    const sameOwner = () =>
      useUserStore.getState().currentUser?.id === target.ownerId &&
      useExperienceSourcesStore.getState().generation === target.generation

    const unsubscribe = useExperienceSourcesStore.subscribe(() => {
      if (!sameOwner()) task.controller.abort()
    })

    try {
      if (!sameOwner()) task.controller.abort()

      task.controller.signal.throwIfAborted()
      await ensureConversation(target)
      task.controller.signal.throwIfAborted()

      task.status = 'reading'
      publish()

      const result = await persistExperienceUpload({
        operationId: task.operationId,
        conversationId: target.conversationId,
        name: task.file.name.slice(0, 160),
        file: task.file,
        extracted: task.extracted,
        controller: task.controller,
        onExtracted: (extracted) => {
          task.extracted = extracted
        },
        onSaving: () => {
          task.status = 'saving'
          publish()
        },
      })

      jobsRef.current.delete(task.operationId)

      if (!sameOwner()) return

      useExperienceSourcesStore.getState().invalidate(result.source.id)

      updateConversationDraft(
        useAssistantStore,
        target.ownerId,
        target.conversationId,
        (draft) => ({
          composerReferences: uniqueReferences([
            ...draft.composerReferences,
            {
              type: 'reference',
              kind: 'experience',
              id: result.source.id,
              versionId: result.versionId,
              label: result.source.name,
            },
          ]),
        }),
        target.recoveryEpoch,
        { pauseQueue: false },
      )
    } catch (error) {
      if (task.controller.signal.aborted) {
        jobsRef.current.delete(task.operationId)

        return
      }

      task.status =
        error instanceof ExperienceSourceError && error.outcome === 'unknown'
          ? 'unknown'
          : 'failed'
      task.error = error instanceof Error ? error.message : '文件保存失败'
    } finally {
      unsubscribe()
      publish()
    }
  }

  return {
    tasks: tasks.filter(
      (task) =>
        task.target.ownerId === ownerId &&
        task.target.generation === generation &&
        (conversationId
          ? task.target.conversationId === conversationId
          : task.target.view === view),
    ),
    addFiles: (files: File[]) => {
      if (!files.length) return

      const state = useAssistantStore.getState()
      const ownerId = useUserStore.getState().currentUser?.id

      if (!ownerId) return

      const generation = useExperienceSourcesStore.getState().generation

      const key = JSON.stringify([
        ownerId,
        generation,
        state.activeConversationId ?? state.conversationViewVersion,
      ])

      let target = conversationsRef.current.get(key)

      if (!target) {
        target = {
          conversationId: state.activeConversationId ?? crypto.randomUUID(),
          ownerId,
          generation,
          view: state.conversationViewVersion,
          recoveryEpoch: getDraftRecoveryEpoch(ownerId),
          persisted: Boolean(state.activeConversationId),
        }

        conversationsRef.current.set(key, target)

        if (!state.activeConversationId)
          reserveNewConversationDraft(
            useAssistantStore,
            ownerId,
            target.conversationId,
          )
      }

      for (const file of files) {
        const task: UploadTask = {
          operationId: crypto.randomUUID(),
          file,
          target,
          status: target.persisted ? 'reading' : 'preparing',
          controller: new AbortController(),
        }

        jobsRef.current.set(task.operationId, task)
        run(task)
      }
    },
    retry: (task: UploadTask) => {
      run(task)
    },
    remove: (task: UploadTask) => {
      task.controller.abort()
      jobsRef.current.delete(task.operationId)

      if (
        !task.target.persisted &&
        ![...jobsRef.current.values()].some((job) => job.target === task.target)
      )
        task.target.controller?.abort()

      publish()
    },
  }
}

function isCurrentUpload(task: UploadTask) {
  const state = useAssistantStore.getState()

  return (
    task.target.ownerId === useUserStore.getState().currentUser?.id &&
    task.target.generation ===
      useExperienceSourcesStore.getState().generation &&
    (state.activeConversationId
      ? task.target.conversationId === state.activeConversationId
      : task.target.view === state.conversationViewVersion)
  )
}
