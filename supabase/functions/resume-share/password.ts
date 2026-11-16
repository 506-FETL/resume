const PASSWORD_ALGORITHM = 'pbkdf2-sha256'

const PASSWORD_ITERATIONS = 310_000

const PASSWORD_KEY_LENGTH = 32

const PASSWORD_SALT_LENGTH = 16

export function getClientAddress(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlToBytes(value: string) {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')

  const binary = atob(base64)

  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function derivePasswordKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    PASSWORD_KEY_LENGTH * 8,
  )

  return new Uint8Array(bits)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_LENGTH))
  const digest = await derivePasswordKey(password, salt, PASSWORD_ITERATIONS)

  return [
    PASSWORD_ALGORITHM,
    PASSWORD_ITERATIONS,
    bytesToBase64Url(salt),
    bytesToBase64Url(digest),
  ].join('$')
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false

  let difference = 0

  for (let index = 0; index < left.length; index += 1)
    difference |= left[index] ^ right[index]

  return difference === 0
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsValue, saltValue, digestValue] =
    storedHash.split('$')

  const iterations = Number(iterationsValue)

  if (
    algorithm !== PASSWORD_ALGORITHM ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !saltValue ||
    !digestValue
  ) {
    return false
  }

  const salt = base64UrlToBytes(saltValue)
  const expectedDigest = base64UrlToBytes(digestValue)
  const actualDigest = await derivePasswordKey(password, salt, iterations)

  return timingSafeEqual(actualDigest, expectedDigest)
}
