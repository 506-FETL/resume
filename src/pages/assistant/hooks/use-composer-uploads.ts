import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { persistExperienceUpload } from '@/lib/experience-sources/upload'
import { ExperienceSourceError } from '@/lib/experience-sources/types'
import type { ExtractedExperienceFile } from '@/lib/experience-sources/types'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import useUserStore from '@/store/user'
import useAssistantStore from '../store'

type UploadTask = {
  operationId: string
  file: File
  extracted?: ExtractedExperienceFile
  generation: number
  ownerId: string
  view: number
  status: 'reading' | 'saving' | 'failed' | 'unknown'
  error?: string
  controller: AbortController
}

export function useComposerUploads() {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const jobsRef = useRef(new Map<string, UploadTask>())
  const ownerId = useUserStore((state) => state.currentUser?.id)
  const view = useAssistantStore((state) => state.conversationViewVersion)
  const generation = useExperienceSourcesStore((state) => state.generation)

  const publish = useCallback(() => {
    const tasks = [...jobsRef.current.values()]
    const ownerId = useUserStore.getState().currentUser?.id
    const view = useAssistantStore.getState().conversationViewVersion
    const generation = useExperienceSourcesStore.getState().generation

    setTasks(tasks)

    useAssistantStore.setState({
      composerUploadCount: tasks.filter(
        (task) =>
          task.ownerId === ownerId &&
          task.view === view &&
          task.generation === generation,
      ).length,
    })
  }, [])

  useEffect(() => {
    publish()
  }, [ownerId, view, generation, publish])

  useEffect(
    () => () => {
      for (const task of jobsRef.current.values()) task.controller.abort()

      useAssistantStore.setState({ composerUploadCount: 0 })
    },
    [],
  )

  async function run(task: UploadTask) {
    task.status = 'reading'
    task.error = undefined
    task.controller = new AbortController()
    publish()

    const sameOwner = () =>
      useUserStore.getState().currentUser?.id === task.ownerId &&
      useExperienceSourcesStore.getState().generation === task.generation

    try {
      const result = await persistExperienceUpload({
        operationId: task.operationId,
        name: task.file.name.slice(0, 160),
        file: task.file,
        extracted: task.extracted,
        controller: task.controller,
        onExtracted: (extracted) => {
          task.extracted = extracted
        },
        onSaving: () => {
          if (!sameOwner()) task.controller.abort()

          task.controller.signal.throwIfAborted()
          task.status = 'saving'
          publish()
        },
      })

      jobsRef.current.delete(task.operationId)
      publish()

      if (!sameOwner()) return

      useExperienceSourcesStore.getState().invalidate(result.source.id)

      if (useAssistantStore.getState().conversationViewVersion !== task.view) {
        toast.info('文件已存入职业档案，可在需要的对话中选用')

        return
      }

      useAssistantStore.getState().addComposerReferences([
        {
          type: 'reference',
          kind: 'experience',
          id: result.source.id,
          versionId: result.versionId,
          label: result.source.name,
        },
      ])
    } catch (error) {
      if (task.controller.signal.aborted) return

      task.status =
        error instanceof ExperienceSourceError && error.outcome === 'unknown'
          ? 'unknown'
          : 'failed'
      task.error = error instanceof Error ? error.message : '文件保存失败'
      publish()
    }
  }

  return {
    tasks: tasks.filter(
      (task) =>
        task.ownerId === ownerId &&
        task.generation === useExperienceSourcesStore.getState().generation &&
        task.view === view,
    ),
    addFiles: (files: File[]) => {
      if (!ownerId) return

      for (const file of files) {
        const task: UploadTask = {
          operationId: crypto.randomUUID(),
          file,
          ownerId,
          generation: useExperienceSourcesStore.getState().generation,
          view,
          status: 'reading',
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
      publish()
    },
  }
}
