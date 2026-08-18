const REDIRECT_BASE = 'https://resume.local'
const MAX_PATH_DECODE_DEPTH = 4

function hasControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1F || codePoint === 0x7F
  })
}

function getRawPathname(value: string) {
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const endIndexes = [queryIndex, hashIndex].filter(index => index >= 0)
  const endIndex = endIndexes.length > 0 ? Math.min(...endIndexes) : value.length
  return value.slice(0, endIndex)
}

function isUnsafePathname(pathname: string) {
  return hasControlCharacter(pathname)
    || pathname.includes('\\')
    || pathname.startsWith('//')
}

function hasSafeDecodedPathname(pathname: string) {
  let current = pathname

  for (let depth = 0; depth <= MAX_PATH_DECODE_DEPTH; depth += 1) {
    if (isUnsafePathname(current))
      return false

    let decoded: string
    try {
      decoded = decodeURIComponent(current)
    }
    catch {
      return false
    }

    if (decoded === current)
      return true
    if (depth === MAX_PATH_DECODE_DEPTH)
      return false

    current = decoded
  }

  return false
}

export function sanitizeAppRedirect(value: string | null | undefined, fallback = '/resume') {
  if (!value || hasControlCharacter(value) || !value.startsWith('/') || value.startsWith('//'))
    return fallback

  if (!hasSafeDecodedPathname(getRawPathname(value)))
    return fallback

  try {
    const parsed = new URL(value, REDIRECT_BASE)
    if (parsed.origin !== REDIRECT_BASE || !hasSafeDecodedPathname(parsed.pathname))
      return fallback

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  }
  catch {
    return fallback
  }
}
