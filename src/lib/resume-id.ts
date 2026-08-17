// Postgres 的 uuid 输入接受任意 128 位 UUID 值；这里只校验数据库返回的标准连字符格式，
// 不额外限制版本位，避免误拒绝合法但非 v1-v8 的历史数据。
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu

export function isCloudResumeId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export class ResumeNotFoundError extends Error {
  readonly code = 'RESUME_NOT_FOUND'

  constructor() {
    super('简历不存在、已删除或无权访问')
    this.name = 'ResumeNotFoundError'
  }
}

export function isResumeNotFoundError(error: unknown): error is ResumeNotFoundError {
  return error instanceof ResumeNotFoundError
    || (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'RESUME_NOT_FOUND')
}
