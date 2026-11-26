import {
  getOfflineResumeById,
  getOfflineResumeProjection,
} from '@/lib/offline-resume-manager/queries'
import { getOrderedOfflineResumeIds } from '@/lib/offline-resume-manager/library-index'
import {
  isCloudResumeId,
  isOfflineResumeId,
  ResumeNotFoundError,
} from '@/lib/resume-id'
import supabase from '@/lib/supabase/client'
import { RESUME_RENDER_SELECTOR } from '@/lib/supabase/resume/persisted-fields'
import { readOwnedResumeRow } from '@/lib/supabase/resume/read-owned-row'
import { ensureCloudResumeTemplateBinding } from '@/lib/supabase/resume/template-binding'
import { buildResumeSnapshot } from '@/pages/history/utils/snapshot'

export interface CanvasResume {
  id: string
  name: string
  updatedAt?: string
  snapshot: ReturnType<typeof buildResumeSnapshot>
}

const fields = `resume_id,display_name,updated_at,${RESUME_RENDER_SELECTOR}`
const snapshots = new Map<string, CanvasResume>()
const pending = new Map<string | null, Promise<CanvasResume | null>>()

export function invalidateCanvasResumes(id?: string) {
  if (id) {
    snapshots.delete(id)
    pending.delete(id)
    pending.delete(null)
  } else {
    snapshots.clear()
    pending.clear()
  }
}

export function loadCanvasResume(owner: string, id: string | null) {
  const current = pending.get(id)

  if (current) return current

  const request = readResume(owner, id)
    .then((resume) => {
      if (resume && pending.get(id) === request) {
        snapshots.set(resume.id, resume)

        if (snapshots.size > 12)
          snapshots.delete(snapshots.keys().next().value!)
      }

      return resume
    })
    .finally(() => {
      if (pending.get(id) === request) pending.delete(id)
    })

  pending.set(id, request)

  return request
}

async function readResume(
  owner: string,
  id: string | null,
): Promise<CanvasResume | null> {
  if (!id) {
    const { data, error } = await supabase
      .from('resume_config')
      .select(fields)
      .eq('user_id', owner)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
      .overrideTypes<Record<string, unknown>, { merge: false }>()

    if (error) throw error
    if (data) return cloudPreview(owner, data)

    const [localId] = await getOrderedOfflineResumeIds(1)

    return localId ? localPreview(localId) : null
  }

  if (!isOfflineResumeId(id) && !isCloudResumeId(id))
    throw new ResumeNotFoundError()

  const cached = snapshots.get(id)

  if (cached?.updatedAt) {
    const meta = isOfflineResumeId(id)
      ? await getOfflineResumeProjection(id, ['updated_at'])
      : await readOwnedResumeRow(id, owner, 'updated_at')

    if (meta.updated_at === cached.updatedAt) return cached
  }

  return isOfflineResumeId(id)
    ? localPreview(id)
    : cloudPreview(owner, await readOwnedResumeRow(id, owner, fields))
}

async function cloudPreview(owner: string, record: Record<string, unknown>) {
  const id = record.resume_id as string

  const binding = await ensureCloudResumeTemplateBinding(
    id,
    owner,
    record.template_binding,
  )

  return {
    id,
    name: (record.display_name as string | null) ?? '未命名',
    updatedAt: record.updated_at as string | undefined,
    snapshot: buildResumeSnapshot({ ...record, template_binding: binding }),
  }
}

async function localPreview(id: string) {
  const record = await getOfflineResumeById(id)

  if (!record) throw new ResumeNotFoundError()

  return {
    id,
    name: record.display_name ?? '未命名',
    updatedAt: record.updated_at,
    snapshot: buildResumeSnapshot({ ...record.data, type: record.type }),
  }
}
