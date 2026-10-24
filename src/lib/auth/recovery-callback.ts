// Capture callback intent before the SDK consumes the URL. URL fields never grant access.
const url = new URL(window.location.href)
const hash = new URLSearchParams(url.hash.slice(1))

export const recoveryCallback = {
  isResetPage: url.pathname === '/reset-password',
  hasCode: url.searchParams.has('code'),
  hasTokens: hash.has('access_token'),
  isRecovery:
    hash.get('type') === 'recovery' ||
    url.searchParams.get('type') === 'recovery',
  hasError: ['error', 'error_code', 'error_description'].some(
    (key) => hash.has(key) || url.searchParams.has(key),
  ),
}
