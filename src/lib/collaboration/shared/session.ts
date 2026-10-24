export type CollaborationRole = 'host' | 'guest'

export function createCollaborationSessionId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

export function buildCollaborationShareUrl(
  resumeId: string,
  sessionId: string,
  documentUrl?: string,
) {
  const url = new URL(`${window.location.origin}/resume/editor`)
  url.searchParams.set('resumeId', resumeId)
  url.searchParams.set('collabSession', sessionId)

  if (documentUrl) {
    url.searchParams.set('docUrl', documentUrl)
  }

  return url.toString()
}

export function buildCollaborationRoomName(
  resumeId: string,
  sessionId: string,
) {
  return `resume-collab:${resumeId}:${sessionId}`
}
