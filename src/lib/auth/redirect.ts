const REDIRECT_BASE = 'https://resume.local'

export function sanitizeAppRedirect(value: string | null | undefined, fallback = '/resume') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return fallback

  try {
    const parsed = new URL(value, REDIRECT_BASE)
    if (parsed.origin !== REDIRECT_BASE)
      return fallback

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  }
  catch {
    return fallback
  }
}
