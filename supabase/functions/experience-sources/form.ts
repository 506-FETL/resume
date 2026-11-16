import { fail } from './errors.ts'
import { EXPERIENCE_MAX_BYTES } from '../shared/experience-source-contract.ts'

export async function boundedForm(request: Request): Promise<FormData> {
  const reader = request.body?.getReader()

  if (!reader) fail('invalid_request', '请求为空。')

  const chunks: ArrayBuffer[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    size += value.byteLength

    if (size > EXPERIENCE_MAX_BYTES + 8 * 1024 * 1024) {
      await reader.cancel()
      fail('too_large', '文件或提取内容过大。', 413)
    }

    chunks.push(new Uint8Array(value).buffer)
  }

  try {
    return await new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: new Blob(chunks),
    }).formData()
  } catch {
    return fail('invalid_request', '请求格式无效。')
  }
}
