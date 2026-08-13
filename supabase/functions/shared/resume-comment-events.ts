import type { RealtimeCommentAccessToken } from './resume-comment-auth.ts'
import { signCommentToken } from './resume-comment-auth.ts'

const encoder = new TextEncoder()
const REALTIME_BUCKET_SECONDS = 15 * 60

interface RealtimeChannel {
  httpSend: (
    event: 'invalidate',
    payload: { eventSeq: number, type: string },
  ) => Promise<unknown>
  unsubscribe: () => Promise<unknown>
}

export interface RealtimeAdminClient {
  channel: (topic: string) => RealtimeChannel
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function topicDigest(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return bytesToBase64Url(new Uint8Array(digest))
}

function currentBucket(nowSeconds: number): { bucket: number, expiresAt: number } {
  const bucket = Math.floor(nowSeconds / REALTIME_BUCKET_SECONDS)
  return {
    bucket,
    expiresAt: (bucket + 1) * REALTIME_BUCKET_SECONDS,
  }
}

export async function deriveScopeRealtimeTopic({
  scopeId,
  versionId,
  secret,
  nowSeconds = Math.floor(Date.now() / 1_000),
}: {
  scopeId: string
  versionId: number
  secret: string
  nowSeconds?: number
}) {
  const { bucket, expiresAt } = currentBucket(nowSeconds)
  const digest = await topicDigest(
    `${scopeId}:version:${versionId}:${bucket}`,
    secret,
  )
  return { topic: `resume-comments:${digest}`, expiresAt }
}

export async function deriveOwnerRealtimeTopic({
  userId,
  secret,
  nowSeconds = Math.floor(Date.now() / 1_000),
}: {
  userId: string
  secret: string
  nowSeconds?: number
}) {
  const { bucket, expiresAt } = currentBucket(nowSeconds)
  const digest = await topicDigest(`owner:${userId}:${bucket}`, secret)
  return { topic: `resume-comment-owner:${digest}`, expiresAt }
}

export async function issueRealtimeAccess({
  topic,
  scopeId,
  userId,
  expiresAt,
  tokenSecret,
}: {
  topic: string
  scopeId?: string
  userId?: string
  expiresAt: number
  tokenSecret: string
}) {
  const issuedAt = Math.floor(Date.now() / 1_000)
  const payload: RealtimeCommentAccessToken = {
    version: 1,
    kind: 'realtime',
    issuedAt,
    expiresAt,
    topic,
    ...(scopeId ? { scopeId } : {}),
    ...(userId ? { userId } : {}),
  }
  return {
    topic,
    expiresAt: new Date(expiresAt * 1_000).toISOString(),
    token: await signCommentToken(payload, tokenSecret),
  }
}

export async function broadcastCommentInvalidation({
  admin,
  topics,
  eventSeq,
  type,
}: {
  admin: RealtimeAdminClient
  topics: readonly string[]
  eventSeq: number
  type: string
}) {
  await Promise.allSettled(topics.map(async (topic) => {
    const channel = admin.channel(topic)
    try {
      await channel.httpSend('invalidate', { eventSeq, type })
    }
    finally {
      await channel.unsubscribe()
    }
  }))
}
