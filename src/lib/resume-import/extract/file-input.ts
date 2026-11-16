import { MAX_RESUME_TEXT_LENGTH } from '../const'
import { ResumeImportError } from '../types'

export function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('已取消读取文件', 'AbortError')
}

export function validateText(text: string): string {
  if (text.length > MAX_RESUME_TEXT_LENGTH) {
    throw new ResumeImportError(
      'too-much-text',
      '文件中的文字超过 60000 字符，请删减后再导入。',
    )
  }
  if (!text.trim())
    throw new ResumeImportError('empty', '文件中没有可读取的文字，请改用粘贴。')

  return text.trim()
}

export function readFile(
  file: File,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  checkAbort(signal)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const abort = () => reader.abort()
    const cleanup = () => signal?.removeEventListener('abort', abort)

    reader.onload = () => {
      cleanup()
      resolve(reader.result as ArrayBuffer)
    }
    reader.onerror = () => {
      cleanup()

      reject(
        new ResumeImportError(
          'corrupt',
          '无法读取文件，请重新选择或粘贴文字。',
        ),
      )
    }
    reader.onabort = () => {
      cleanup()
      reject(new DOMException('已取消读取文件', 'AbortError'))
    }

    signal?.addEventListener('abort', abort, { once: true })
    reader.readAsArrayBuffer(file)
  })
}
