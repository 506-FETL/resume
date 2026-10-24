import type {
  AtsCreatePayload,
  AtsLlmDraft,
  AtsPersistPatch,
} from '@/lib/schema/ats'

export function sanitizeAtsPersistInput(
  input: AtsLlmDraft | AtsPersistPatch | AtsCreatePayload,
): AtsPersistPatch {
  const payload: AtsPersistPatch = {}

  if (input.todo_items !== undefined) {
    payload.todo_items = input.todo_items
  }

  if (input.version !== undefined) {
    payload.version = input.version
  }

  if (input.meta !== undefined) {
    payload.meta = input.meta
  }

  if (input.readabilityIndex !== undefined) {
    payload.readabilityIndex = input.readabilityIndex
  }

  if (input.fixChecklist !== undefined) {
    payload.fixChecklist = input.fixChecklist
  }

  if (input.summary !== undefined) {
    payload.summary = input.summary
  }

  if (input.scores !== undefined) {
    payload.scores = input.scores
  }

  if (input.findings !== undefined) {
    payload.findings = input.findings
  }

  if (typeof input.resume_id === 'string' && input.resume_id.length > 0) {
    payload.resume_id = input.resume_id
  }

  return payload
}

export function buildAtsCreatePayload(
  input: AtsLlmDraft | AtsPersistPatch | AtsCreatePayload,
  resumeId: string,
): AtsCreatePayload {
  return {
    ...sanitizeAtsPersistInput(input),
    resume_id: resumeId,
  }
}
