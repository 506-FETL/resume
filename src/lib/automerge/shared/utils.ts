import { BASE64_CHUNK_SIZE } from './constants'

export function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = ''

  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + BASE64_CHUNK_SIZE)
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }

  return btoa(binary)
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes
}

/**
 * 将 Supabase 返回的 BYTEA / Base64 / Uint8Array 统一解码为 Uint8Array。
 */
export function decodeDocumentData(raw: unknown): Uint8Array | null {
  if (raw instanceof Uint8Array) {
    return raw
  }

  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw)
  }

  if (Array.isArray(raw)) {
    return new Uint8Array(raw)
  }

  if (typeof raw === 'string') {
    if (raw.startsWith('\\x')) {
      const hex = raw.slice(2)
      if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/iu.test(hex)) {
        return null
      }
      const bytes = new Uint8Array(hex.length / 2)
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
      }
      return bytes
    }
    return decodeBase64ToBytes(raw)
  }

  return null
}
