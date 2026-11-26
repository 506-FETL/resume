import type {
  CreatedTemplateResume,
  CreateTemplateResumeInput,
} from '@/lib/resume-template/create/types'
import {
  collectSectionEvidence,
  recordPreparationEvidence,
} from '@/lib/resume-preparation/evidence'
import { CreationLookupFailedError } from '@/lib/resume-template/create/types'
import { exampleKey, templateKey } from '@/lib/resume-template/source/types'
import { DEFAULT_ORDER } from '@/lib/schema/resume/form'
import useResumeListStore from '@/pages/resume/store'
import { useResumeCreationStore } from '@/store/resume-creation'
import { useResumeTemplateStore } from '@/store/resume-template'
import useCurrentResumeStore from '@/store/resume/current'

export function saveTemplateResume(operation: CreateTemplateResumeInput) {
  const resources = useResumeTemplateStore.getState()
  const definition = resources.definitions[templateKey(operation.template)]
  const example = resources.examples[exampleKey(operation.example)]

  return useResumeCreationStore
    .getState()
    .start(
      operation,
      definition?.status === 'ready' && example?.status === 'ready'
        ? { definition: definition.data, example: example.data }
        : undefined,
    )
}

export function failedBeforeWrite(
  operationId: string | undefined,
  reason: unknown,
) {
  const prepared = useResumeCreationStore.getState().prepared

  return (
    prepared?.operationId !== operationId ||
    reason instanceof CreationLookupFailedError
  )
}

export async function recordExampleEvidence(
  result: CreatedTemplateResume,
  ownerId: string | null,
) {
  const prepared = useResumeCreationStore.getState().prepared

  if (prepared?.resumeId !== result.resumeId) return

  await recordPreparationEvidence(
    result.resumeId,
    ownerId,
    DEFAULT_ORDER.flatMap((section) =>
      collectSectionEvidence(section, prepared.snapshot[section], 'example'),
    ),
    '简历已创建，示例检查记录保存失败，请在导出前重试',
  )
}

export function openCreatedResume(result: CreatedTemplateResume) {
  useResumeListStore.getState().addResume({
    resume_id: result.resumeId,
    display_name: result.displayName,
    description: result.description,
    type: result.type,
    created_at: result.createdAt,
    updated_at: result.updatedAt,
    isOffline: result.mode === 'local',
    templateBinding: result.templateBinding,
  })

  useCurrentResumeStore
    .getState()
    .setCurrentResume(result.resumeId, result.type)

  useResumeCreationStore.getState().reset()
}
