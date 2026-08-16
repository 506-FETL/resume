import assert from 'node:assert/strict'
import {
  classifyUpstreamFailure,
  streamFailureDeliveryState,
} from '../supabase/functions/llm-proxy/core.ts'

const expectedFailures = new Map([
  [400, ['upstream_invalid_request', 400, 'upstream_400']],
  [401, ['upstream_auth', 502, 'upstream_401']],
  [402, ['upstream_balance', 503, 'upstream_402']],
  [422, ['upstream_invalid_request', 400, 'upstream_422']],
  [429, ['upstream_rate_limited', 429, 'upstream_429']],
  [500, ['upstream_unavailable', 503, 'upstream_500']],
  [503, ['upstream_unavailable', 503, 'upstream_503']],
] as const)

for (const [upstreamStatus, [code, responseStatus, failure]] of expectedFailures) {
  assert.deepEqual(classifyUpstreamFailure(upstreamStatus), {
    code,
    status: responseStatus,
    failure,
  })
}

assert.equal(streamFailureDeliveryState(false), 'none')
assert.equal(streamFailureDeliveryState(true), 'partial')

console.warn('llm proxy failure contracts verified')
