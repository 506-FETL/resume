import type { PreparedResumeCreation } from '@/lib/resume-template/create/types'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import { isCloudResumeId } from '@/lib/resume-id'
import { notifyResumeReadChanged } from '@/lib/resume-read-events'
import { readResumeListTemplateBinding } from '@/lib/resume-template/binding'
import {
  getCreationAccountVersion,
  rememberCreatedResumeInitialization,
} from '@/lib/resume-template/create/initialization-handoff'
import supabase from '../client'
import { getCurrentUser } from '../user'
import {
  RESUME_PERSISTED_FIELDS,
  RESUME_PERSISTED_SELECTOR,
} from './persisted-fields'

const CREATED_RESUME_SELECTOR =
  'resume_id,display_name,description,created_at,updated_at'

interface CreatedResumeRecord extends Record<string, unknown> {
  resume_id: string
  display_name: string | null
  description: string | null
  created_at: string
  updated_at: string | null
}

export async function findPreparedCloudResume(
  prepared: PreparedResumeCreation,
) {
  const user = await assertCreationOwner(prepared)

  const { data, error } = await supabase
    .from('resume_config')
    .select(CREATED_RESUME_SELECTOR)
    .eq('user_id', user.id)
    .eq('resume_id', prepared.resumeId)
    .maybeSingle()

  if (error) throw error

  return data
}

export async function createResumeFromSnapshot(
  prepared: PreparedResumeCreation,
) {
  const accountVersion = getCreationAccountVersion()
  const user = await assertCreationOwner(prepared)

  const source: Record<string, unknown> = {
    ...prepared.snapshot,
    template_binding: prepared.snapshot.templateBinding,
  }

  const fields = Object.fromEntries(
    RESUME_PERSISTED_FIELDS.filter((key) => key in source).map((key) => [
      key,
      source[key],
    ]),
  )

  const { data, error } = await supabase
    .from('resume_config')
    .insert({
      ...fields,
      type: 'default',
      resume_id: prepared.resumeId,
      user_id: user.id,
      display_name: prepared.displayName,
      description: prepared.description,
    })
    .select(`${CREATED_RESUME_SELECTOR},${RESUME_PERSISTED_SELECTOR}`)
    .single()
    .overrideTypes<CreatedResumeRecord, { merge: false }>()

  if (error) throw error

  notifyResumeReadChanged(prepared.resumeId)
  rememberInitialization(data, user.id, accountVersion)

  return data
}

async function assertCreationOwner(prepared: PreparedResumeCreation) {
  const user = await getCurrentUser()

  if (!user || user.id !== prepared.ownerId)
    throw new Error('登录状态已改变，请使用发起创建时的账号重试')
  if (
    prepared.mode !== 'cloud' ||
    prepared.resumeId !== prepared.operationId ||
    !isCloudResumeId(prepared.resumeId)
  )
    throw new Error('云端创建操作无效')

  return user
}

function rememberInitialization(
  record: CreatedResumeRecord,
  ownerId: string,
  accountVersion: number,
) {
  const templateBinding = readResumeListTemplateBinding(record.template_binding)

  if (!templateBinding || typeof record.updated_at !== 'string') return

  const snapshot = Object.fromEntries(
    RESUME_PERSISTED_FIELDS.filter((key) => key !== 'template_binding').map(
      (key) => [key, record[key]],
    ),
  )

  rememberCreatedResumeInitialization(
    {
      ownerId,
      resumeId: record.resume_id,
      updatedAt: record.updated_at,
      snapshot: {
        ...snapshot,
        templateBinding,
      } as Partial<PersistedResumeSnapshot>,
    },
    accountVersion,
  )
}
