function hashUserId(userId: string) {
  let hash = 2166136261
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createParticipantColor(userId: string) {
  return `hsl(${hashUserId(userId) % 360}, 85%, 60%)`
}
