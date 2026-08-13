import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import {
  hashAnonymousSecret,
  signCommentToken,
  verifyCommentToken,
} from '../supabase/functions/shared/resume-comment-auth.ts'
import {
  buildCommentAnchorDocument,
} from '../supabase/functions/shared/resume-comment-core.ts'
import {
  broadcastCommentInvalidation,
  deriveOwnerRealtimeTopic,
  deriveScopeRealtimeTopic,
} from '../supabase/functions/shared/resume-comment-events.ts'
import {
  CommentApiError,
  isSafeCommentLink,
  normalizeCommentBody,
  readCommentAnchor,
  readCommentOp,
} from '../supabase/functions/shared/resume-comment-schema.ts'

assert.match(
  buildCommentAnchorDocument({ basics: { name: '张三' }, order: ['basics'] }, '2026-08-14').documentHash,
  /^[0-9a-f]{64}$/u,
)
const edgeSource = readFileSync('supabase/functions/resume-comments/index.ts', 'utf8')
assert.match(edgeSource, /ensure_resume_working_comment_scope/u)
assert.match(edgeSource, /buildCommentAnchorDocument\(resume, projectionReferenceDate\)/u)
const shareEdgeSource = readFileSync('supabase/functions/resume-share/index.ts', 'utf8')
assert.match(shareEdgeSource, /comment_access_token/u)
assert.match(shareEdgeSource, /projection_reference_date/u)
assert.match(shareEdgeSource, /if \(!refreshOnly\)/u)

const secret = 'resume-comment-verification-secret-000000000000'
const now = Math.floor(Date.now() / 1_000)
const sharePayload = {
  version: 1 as const,
  kind: 'share' as const,
  issuedAt: now,
  expiresAt: now + 15 * 60,
  shareId: '00000000-0000-4000-8000-000000000001',
  releaseId: '00000000-0000-4000-8000-000000000002',
  scopeId: '00000000-0000-4000-8000-000000000003',
  passwordGeneration: 'generation',
}

const token = await signCommentToken(sharePayload, secret)
assert.deepEqual(await verifyCommentToken(token, 'share', secret), sharePayload)
const [encodedPayload, encodedSignature] = token.split('.') as [string, string]
const tamperedSignature = Buffer.from(encodedSignature, 'base64url')
tamperedSignature[0] ^= 1
await assert.rejects(
  verifyCommentToken(
    `${encodedPayload}.${tamperedSignature.toString('base64url')}`,
    'share',
    secret,
  ),
  (error: unknown) => error instanceof CommentApiError && error.code === 'unauthorized',
)
await assert.rejects(
  verifyCommentToken(token, 'collaborator', secret),
  (error: unknown) => error instanceof CommentApiError && error.code === 'unauthorized',
)

const anonymousSecret = Buffer.alloc(32, 7).toString('base64url')
assert.match(await hashAnonymousSecret(anonymousSecret, secret), /^[0-9a-f]{64}$/u)
assert.equal(normalizeCommentBody('  评论 👨‍👩‍👧‍👦  '), '评论 👨‍👩‍👧‍👦')
assert.throws(
  () => normalizeCommentBody('x\u0000y'),
  (error: unknown) => error instanceof CommentApiError,
)
assert.throws(
  () => normalizeCommentBody('字'.repeat(2_001)),
  (error: unknown) => error instanceof CommentApiError && error.code === 'content_too_long',
)
assert.equal(isSafeCommentLink('https://example.com/path'), true)
assert.equal(isSafeCommentLink('mailto:user@example.com'), true)
assert.equal(isSafeCommentLink('javascript:alert(1)'), false)
assert.equal(readCommentOp({ op: 'create_thread' }), 'create_thread')
assert.throws(
  () => readCommentOp({ op: 'unknown' }),
  (error: unknown) => error instanceof CommentApiError && error.code === 'not_found',
)

assert.deepEqual(readCommentAnchor({
  nodeKey: 'basics/singleton/name',
  startGraphemeOffset: 0,
  endGraphemeOffset: 1,
  blockOrdinal: 0,
  exactQuote: '张',
  prefix: '',
  suffix: '三',
  nodeTextHash: 'a'.repeat(64),
  createdAtContentHash: 'b'.repeat(64),
}), {
  nodeKey: 'basics/singleton/name',
  startGraphemeOffset: 0,
  endGraphemeOffset: 1,
  blockOrdinal: 0,
  exactQuote: '张',
  prefix: '',
  suffix: '三',
  nodeTextHash: 'a'.repeat(64),
  createdAtContentHash: 'b'.repeat(64),
})

const scopeTopic = await deriveScopeRealtimeTopic({
  scopeId: sharePayload.scopeId,
  releaseId: sharePayload.releaseId,
  secret,
  nowSeconds: 1_800,
})
const sameScopeTopic = await deriveScopeRealtimeTopic({
  scopeId: sharePayload.scopeId,
  releaseId: sharePayload.releaseId,
  secret,
  nowSeconds: 2_699,
})
const nextScopeTopic = await deriveScopeRealtimeTopic({
  scopeId: sharePayload.scopeId,
  releaseId: sharePayload.releaseId,
  secret,
  nowSeconds: 2_700,
})
assert.equal(scopeTopic.topic, sameScopeTopic.topic)
assert.notEqual(scopeTopic.topic, nextScopeTopic.topic)
assert.equal(scopeTopic.topic.includes(sharePayload.scopeId), false)
assert.equal(scopeTopic.expiresAt, 2_700)
assert.notEqual(
  scopeTopic.topic,
  (await deriveOwnerRealtimeTopic({
    userId: '00000000-0000-4000-8000-000000000004',
    secret,
    nowSeconds: 1_800,
  })).topic,
)

const broadcasts: unknown[] = []
await broadcastCommentInvalidation({
  admin: {
    channel: topic => ({
      async httpSend(event, payload) {
        broadcasts.push({ topic, event, payload })
      },
      async unsubscribe() {},
    }),
  },
  topics: [scopeTopic.topic],
  eventSeq: 42,
  type: 'comment_replied',
})
assert.deepEqual(broadcasts, [{
  topic: scopeTopic.topic,
  event: 'invalidate',
  payload: { eventSeq: 42, type: 'comment_replied' },
}])

console.warn('resume comment service verification passed')
