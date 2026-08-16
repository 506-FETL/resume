import { CommentApiError, isRecord } from './resume-comment-schema.ts'

const encoder = new TextEncoder()

export interface CommentTokenBase {
  version: 1
  kind: 'share' | 'realtime'
  issuedAt: number
  expiresAt: number
}

export interface ShareCommentAccessToken extends CommentTokenBase {
  kind: 'share'
  shareId: string
  versionId: number
  releaseId: string
  scopeId: string
  passwordGeneration: string
}

export interface RealtimeCommentAccessToken extends CommentTokenBase {
  kind: 'realtime'
  topic: string
  scopeId?: string
  userId?: string
}

export type CommentAccessToken
  = | ShareCommentAccessToken
    | RealtimeCommentAccessToken

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

async function importHmacKey(secret: string) {
  if (secret.length < 32) {
    throw new Error('Comment token secret must contain at least 32 characters')
  }
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signCommentToken(
  payload: CommentAccessToken,
  secret: string,
): Promise<string> {
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)))
  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload))
  return `${encodedPayload}.${bytesToBase64Url(new Uint8Array(signature))}`
}

function readTokenPayload(value: unknown): CommentAccessToken {
  if (
    !isRecord(value)
    || value.version !== 1
    || !['share', 'realtime'].includes(String(value.kind))
    || !Number.isInteger(value.issuedAt)
    || !Number.isInteger(value.expiresAt)
  ) {
    throw new CommentApiError('unauthorized', '评论访问凭证无效', 401)
  }
  return value as unknown as CommentAccessToken
}

export async function verifyCommentToken<TKind extends CommentAccessToken['kind']>(
  token: string,
  expectedKind: TKind,
  secret: string,
): Promise<Extract<CommentAccessToken, { kind: TKind }>> {
  const [encodedPayload, encodedSignature, extra] = token.split('.')
  if (!encodedPayload || !encodedSignature || extra) {
    throw new CommentApiError('unauthorized', '评论访问凭证无效', 401)
  }
  let payloadValue: unknown
  let signature: Uint8Array
  try {
    payloadValue = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload)))
    signature = base64UrlToBytes(encodedSignature)
  }
  catch {
    throw new CommentApiError('unauthorized', '评论访问凭证无效', 401)
  }
  const key = await importHmacKey(secret)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    encoder.encode(encodedPayload),
  )
  if (!valid) {
    throw new CommentApiError('unauthorized', '评论访问凭证无效', 401)
  }
  const payload = readTokenPayload(payloadValue)
  const now = Math.floor(Date.now() / 1_000)
  if (
    payload.kind !== expectedKind
    || payload.issuedAt > now + 30
    || payload.expiresAt <= now
    || payload.expiresAt - payload.issuedAt > 15 * 60
  ) {
    throw new CommentApiError('unauthorized', '评论访问凭证已失效', 401)
  }
  return payload as Extract<CommentAccessToken, { kind: TKind }>
}

export function isAnonymousSecret(value: string): boolean {
  try {
    return base64UrlToBytes(value).length === 32
  }
  catch {
    return false
  }
}

export async function hashAnonymousSecret(
  secret: string,
  pepper: string,
): Promise<string> {
  if (!isAnonymousSecret(secret) || pepper.length < 32) {
    throw new CommentApiError('unauthorized', '匿名评论凭证无效', 401)
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`${pepper}:${secret}`),
  )
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  if (leftBytes.length !== rightBytes.length) {
    return false
  }
  let difference = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index]
  }
  return difference === 0
}

export async function derivePasswordGeneration(
  passwordHash: string | null,
  secret: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`${secret}:password:${passwordHash ?? 'none'}`),
  )
  return bytesToBase64Url(new Uint8Array(digest)).slice(0, 22)
}
