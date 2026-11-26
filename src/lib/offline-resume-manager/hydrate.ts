import { readResumeListTemplateBinding } from '@/lib/resume-template/binding'
import { resolveDefaultTemplateBinding } from '@/lib/resume-template/runtime/default-selection'
import type { IDBPDatabase } from 'idb'
import type { OfflineResumeRecord, ResumeDB } from './database'

import { hasPersistedAppearance, hydrateOfflineResumeData } from './appearance'

export * from './appearance'

export async function hydrateOfflineResumeRecord(
  db: IDBPDatabase<ResumeDB>,
  resume: OfflineResumeRecord | undefined,
): Promise<OfflineResumeRecord | undefined> {
  if (!resume) {
    return resume
  }

  if (
    hasPersistedAppearance(resume.data) &&
    readResumeListTemplateBinding(resume.data?.templateBinding)
  ) {
    return resume
  }

  // 网络等待发生在事务之外；随后重读，防止覆盖其他标签页刚保存的正文或模板。
  const binding = await resolveDefaultTemplateBinding(
    resume.data?.templateBinding,
  )

  const tx = db.transaction('resumes', 'readwrite')
  const latest = await tx.store.get(resume.resume_id)

  if (!latest) {
    await tx.done

    return undefined
  }

  const nextResume = {
    ...latest,
    data: {
      ...hydrateOfflineResumeData(latest.data),
      templateBinding:
        readResumeListTemplateBinding(latest.data?.templateBinding) ?? binding,
    },
  }

  await tx.store.put(nextResume)
  await tx.done

  return nextResume
}
