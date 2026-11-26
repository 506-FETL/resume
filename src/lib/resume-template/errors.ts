export type TemplateErrorCode =
  | 'INVALID_BINDING'
  | 'INVALID_DEFINITION'
  | 'VERSION_NOT_FOUND'
  | 'UNSUPPORTED_CAPABILITY'
  | 'REFERENCE_MISMATCH'
  | 'LOAD_FAILED'
  | 'RESOURCE_LIMIT'

export class TemplateResolutionError extends Error {
  readonly code: TemplateErrorCode
  constructor(code: TemplateErrorCode, message: string) {
    super(message)
    this.name = 'TemplateResolutionError'
    this.code = code
  }
}

export function asTemplateError(error: unknown): TemplateResolutionError {
  return error instanceof TemplateResolutionError
    ? error
    : new TemplateResolutionError('LOAD_FAILED', '模板资源加载失败，请重试')
}
