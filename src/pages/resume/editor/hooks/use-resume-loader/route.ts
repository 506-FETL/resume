import type { AutomergeUrl } from '@automerge/automerge-repo'
import { parseAutomergeUrl } from '@automerge/automerge-repo/slim'

export type CollaborationRoute =
  | { kind: 'none' }
  | {
      kind: 'invite'
      resumeId: string
      sessionId: string
      documentUrl: string
      documentId: string
    }
  | { kind: 'host-recovery'; resumeId: string; sessionId: string }
  | { kind: 'invalid' }

export interface LoadedDocumentIdentity {
  resumeId: string
  source: 'owner' | 'collaboration'
  loadKey: string
}

export function parseCollaborationRoute(
  params: URLSearchParams,
): CollaborationRoute {
  const hasSessionId = params.has('collabSession')
  const hasDocumentUrl = params.has('docUrl')
  const resumeId = params.get('resumeId')
  const sessionId = params.get('collabSession')
  const documentUrl = params.get('docUrl')

  if (!hasSessionId && !hasDocumentUrl) return { kind: 'none' }
  if (resumeId && sessionId && hasSessionId && !hasDocumentUrl)
    return { kind: 'host-recovery', resumeId, sessionId }
  if (!resumeId || !sessionId || !documentUrl) return { kind: 'invalid' }

  try {
    const { documentId } = parseAutomergeUrl(documentUrl as AutomergeUrl)

    return {
      kind: 'invite',
      resumeId,
      sessionId,
      documentUrl,
      documentId,
    }
  } catch {
    return { kind: 'invalid' }
  }
}

export function getCollaborationLoadKey(
  route: CollaborationRoute,
  activeResumeId?: string,
) {
  if (route.kind === 'invalid') return 'collab:invalid'
  if (route.kind === 'invite')
    return `collab:${route.resumeId}:${route.sessionId}:${route.documentId}`

  return activeResumeId ? `resume:${activeResumeId}` : 'empty'
}
