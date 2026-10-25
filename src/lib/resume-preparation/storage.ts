import type { ImportDraft, PreparationRecord } from './types'
import { openDB } from 'idb'

const listeners = new Set<() => void>()
let revision = 0

let connection: ReturnType<typeof openDB> | null = null

const database = () => {
  connection ??= openDB('resume-preparation', 1, {
    upgrade(db) {
      db.createObjectStore('drafts')
      db.createObjectStore('records')
    },
  }).catch((error) => {
    connection = null

    throw error
  })

  return connection
}

export const preparationScope = (ownerId: string | null) =>
  ownerId ? `account:${ownerId}` : 'guest'

function recordKey(resumeId: string, ownerId: string | null) {
  if (!resumeId.startsWith('local-') && !ownerId)
    throw new Error('请登录后读取这份简历的检查记录')

  return `${preparationScope(ownerId)}:${resumeId}`
}

function notify() {
  revision += 1
  listeners.forEach((listener) => listener())
}

export const subscribePreparation = (listener: () => void) => {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

export const getPreparationRevision = () => revision

export async function loadImportDraft(
  scope: string,
): Promise<ImportDraft | null> {
  const db = await database()

  return (await db.get('drafts', scope)) ?? null
}

export async function saveImportDraft(
  scope: string,
  draft: ImportDraft | null,
) {
  const db = await database()

  if (draft) await db.put('drafts', structuredClone(draft), scope)
  else await db.delete('drafts', scope)

  notify()
}

export async function loadPreparation(
  resumeId: string,
  ownerId: string | null,
): Promise<PreparationRecord> {
  const key = recordKey(resumeId, ownerId)
  const db = await database()

  return (await db.get('records', key)) ?? { evidence: [], resolutions: {} }
}

export async function updatePreparation(
  resumeId: string,
  ownerId: string | null,
  update: (record: PreparationRecord) => PreparationRecord,
) {
  const key = recordKey(resumeId, ownerId)
  const db = await database()
  const tx = db.transaction('records', 'readwrite')

  const record: PreparationRecord = (await tx.store.get(key)) ?? {
    evidence: [],
    resolutions: {},
  }

  await tx.store.put(update(record), key)
  await tx.done
  notify()
}

/** 显式同步只读取当前账户及游客，映射和记录在同一事务内先于上传落盘。 */
export async function prepareOfflineTransfer(
  resumeId: string,
  ownerId: string,
  snapshotSignature?: string,
) {
  const db = await database()
  const tx = db.transaction(['drafts', 'records'], 'readwrite')
  const mappingKey = `migration:${preparationScope(ownerId)}:${resumeId}`

  const stored:
    | string
    | { targetId: string; snapshotSignature?: string }
    | undefined = await tx.objectStore('drafts').get(mappingKey)

  const previous = typeof stored === 'string' ? { targetId: stored } : stored

  if (
    previous?.snapshotSignature &&
    snapshotSignature !== previous.snapshotSignature
  ) {
    tx.abort()
    await tx.done.catch(() => undefined)

    throw new Error(
      '本地简历已不同于上次同步的内容，已保留本地简历。请核对云端副本后再处理。',
    )
  }

  const targetId = previous?.targetId ?? crypto.randomUUID()

  const records = tx.objectStore('records')

  const guest: PreparationRecord | undefined = await records.get(
    recordKey(resumeId, null),
  )

  const owned: PreparationRecord | undefined = await records.get(
    recordKey(resumeId, ownerId),
  )

  const existing: PreparationRecord | undefined = await records.get(
    recordKey(targetId, ownerId),
  )

  const sources = [existing, guest, owned].filter(
    (record): record is PreparationRecord => !!record,
  )

  const merged: PreparationRecord = {
    ...Object.assign({}, ...sources),
    evidence: [
      ...new Map(
        sources
          .flatMap((record) => record.evidence)
          .map((item) => [item.id, item]),
      ).values(),
    ],
    resolutions: Object.assign(
      {},
      ...sources.map((record) => record.resolutions),
    ),
  }

  await records.put(merged, recordKey(targetId, ownerId))

  await tx
    .objectStore('drafts')
    .put({ targetId, snapshotSignature }, mappingKey)

  await tx.done
  notify()

  return targetId
}

/** 未完成的派生使用可恢复的目标身份，刷新或网络结果未知时也不会再克隆。 */
export async function reserveDerivedPreparationId(
  key: string,
  offline: boolean,
) {
  const db = await database()
  const tx = db.transaction('drafts', 'readwrite')
  const storageKey = `derived:${key}`

  const targetId: string =
    (await tx.store.get(storageKey)) ??
    `${offline ? 'local-' : ''}${crypto.randomUUID()}`

  await tx.store.put(targetId, storageKey)
  await tx.done

  return targetId
}

export async function completeDerivedPreparation(key: string) {
  const db = await database()

  await db.delete('drafts', `derived:${key}`)
}
