export function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  let difference = leftBytes.length ^ rightBytes.length
  const length = Math.max(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index += 1)
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  return difference === 0
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')?.trim() ?? ''
  if (authorization.slice(0, 7).toLowerCase() !== 'bearer ')
    return ''
  return authorization.slice(7).trim()
}

export function hasValidMaintenanceToken(
  request: Request,
  expectedToken: string,
) {
  const suppliedToken = readBearerToken(request)
  return (
    suppliedToken.length > 0 && constantTimeEqual(suppliedToken, expectedToken)
  )
}
