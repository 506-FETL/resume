import type { DocHandle, Repo } from '@automerge/automerge-repo'
import type { AutomergeResumeDocument } from './schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import {
  DEFAULT_ORDER,
  DEFAULT_VISIBILITY,
  normalizeResumeAppearance,
} from '@/lib/schema'

interface DocumentIdentity {
  resumeId: string
  userId: string
}

interface CreateDocumentOptions extends DocumentIdentity {
  repo: Repo
  seedData?: Partial<PersistedResumeSnapshot> | null
}

function buildMetadata(
  existing: Partial<AutomergeResumeDocument['_metadata']> | undefined,
  identity: DocumentIdentity,
) {
  const now = new Date().toISOString()

  return {
    resumeId: existing?.resumeId ?? identity.resumeId,
    userId: existing?.userId ?? identity.userId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: existing?.updatedAt ?? now,
    version: typeof existing?.version === 'number' ? existing.version : 1,
  }
}

export function ensureDocumentMetadata(
  doc: AutomergeResumeDocument,
  identity: DocumentIdentity,
) {
  doc._metadata = buildMetadata(doc._metadata, identity)
  return doc._metadata
}

export function touchDocumentMetadata(
  doc: AutomergeResumeDocument,
  identity: DocumentIdentity,
) {
  const metadata = ensureDocumentMetadata(doc, identity)

  metadata.updatedAt = new Date().toISOString()
  metadata.version =
    typeof metadata.version === 'number' ? metadata.version + 1 : 1
}

export async function createResumeDocument({
  repo,
  resumeId,
  userId,
  seedData,
}: CreateDocumentOptions): Promise<DocHandle<AutomergeResumeDocument>> {
  const handle = repo.create<AutomergeResumeDocument>()

  handle.change((doc) => {
    doc._metadata = buildMetadata(undefined, { resumeId, userId })
    const appearance = normalizeResumeAppearance(seedData)

    if (seedData) {
      Object.assign(doc, seedData)
    }

    if (!doc.order || doc.order.length === 0) {
      doc.order = [...DEFAULT_ORDER] as AutomergeResumeDocument['order']
    }

    if (!doc.visibility) {
      doc.visibility = {
        ...DEFAULT_VISIBILITY,
      } as AutomergeResumeDocument['visibility']
    }

    doc.spacing = {
      ...appearance.spacing,
    } as AutomergeResumeDocument['spacing']
    doc.font = { ...appearance.font } as AutomergeResumeDocument['font']
    doc.theme = { ...appearance.theme } as AutomergeResumeDocument['theme']
  })

  await handle.whenReady()

  return handle
}
