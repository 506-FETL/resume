import type {
  AnonymousCommentCredential,
  ResumeCommentClient,
} from './client.ts'

interface StoredAnonymousCommentIdentity {
  version: 1
  anonymousId: string
  secret: string
}

const ANONYMOUS_STORAGE_PREFIX = 'resume-comment-anonymous-version:'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function getStorageKey(versionId: number) {
  return `${ANONYMOUS_STORAGE_PREFIX}${versionId}`
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function isSecret(value: string) {
  try {
    const base64 = value
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=')
    return atob(base64).length === 32
  }
  catch {
    return false
  }
}

function readStoredIdentity(value: string | null): StoredAnonymousCommentIdentity | null {
  if (!value)
    return null
  try {
    const parsed = JSON.parse(value) as Partial<StoredAnonymousCommentIdentity>
    if (
      parsed.version !== 1
      || typeof parsed.anonymousId !== 'string'
      || !UUID_PATTERN.test(parsed.anonymousId)
      || typeof parsed.secret !== 'string'
      || !isSecret(parsed.secret)
    ) {
      return null
    }
    return parsed as StoredAnonymousCommentIdentity
  }
  catch {
    return null
  }
}

function getLocalStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  }
  catch {
    return null
  }
}

export function loadAnonymousCommentIdentity(versionId: number): AnonymousCommentCredential | null {
  const storage = getLocalStorage()
  if (!storage)
    return null
  const key = getStorageKey(versionId)
  const identity = readStoredIdentity(storage.getItem(key))
  if (!identity) {
    storage.removeItem(key)
    return null
  }
  return { id: identity.anonymousId, secret: identity.secret }
}

export function attachStoredAnonymousCommentIdentity(
  client: ResumeCommentClient,
  versionId: number,
) {
  const identity = loadAnonymousCommentIdentity(versionId)
  client.setAnonymousCredential(identity)
  return identity
}

/** 仅在匿名访问者首次提交评论前调用；浏览分享页本身不会创建身份。 */
export async function ensureAnonymousCommentIdentity(
  client: ResumeCommentClient,
  versionId: number,
): Promise<AnonymousCommentCredential> {
  const existing = loadAnonymousCommentIdentity(versionId)
  if (existing) {
    client.setAnonymousCredential(existing)
    return existing
  }

  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const secret = bytesToBase64Url(bytes)
  const response = await client.createAnonymousIdentity(secret)
  const identity = { id: response.data.anonymousId, secret }
  const storage = getLocalStorage()
  try {
    storage?.setItem(getStorageKey(versionId), JSON.stringify({
      version: 1,
      anonymousId: identity.id,
      secret: identity.secret,
    } satisfies StoredAnonymousCommentIdentity))
  }
  catch {
    // 隐私模式或存储配额异常时，本次页面会话仍可继续使用内存中的凭证。
  }
  client.setAnonymousCredential(identity)
  return identity
}

export function deriveAnonymousAvatarVisual(anonymousId: string) {
  let hash = 2166136261
  for (const character of anonymousId) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const normalized = hash >>> 0
  return {
    hue: normalized % 360,
    pattern: ['rings', 'dots', 'waves', 'grid'][normalized % 4] as 'rings' | 'dots' | 'waves' | 'grid',
    initials: '匿',
  }
}
