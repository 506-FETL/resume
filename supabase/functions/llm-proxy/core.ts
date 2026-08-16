export interface UpstreamFailure {
  code: string
  status: number
  failure: string
}

export function classifyUpstreamFailure(status: number): UpstreamFailure {
  if (status === 400 || status === 422) {
    return {
      code: 'upstream_invalid_request',
      status: 400,
      failure: `upstream_${status}`,
    }
  }
  if (status === 401)
    return { code: 'upstream_auth', status: 502, failure: 'upstream_401' }
  if (status === 402)
    return { code: 'upstream_balance', status: 503, failure: 'upstream_402' }
  if (status === 429) {
    return {
      code: 'upstream_rate_limited',
      status: 429,
      failure: 'upstream_429',
    }
  }
  return {
    code: 'upstream_unavailable',
    status: 503,
    failure: `upstream_${status}`,
  }
}

export function streamFailureDeliveryState(deliveryStarted: boolean) {
  return deliveryStarted ? 'partial' as const : 'none' as const
}
