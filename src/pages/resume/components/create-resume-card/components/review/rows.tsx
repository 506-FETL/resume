import type { ReviewModule } from '../../types'

export function blankRow(module: ReviewModule) {
  return Object.fromEntries([
    ['entryId', crypto.randomUUID()],
    ['hidden', false],
    ...module.fields.map((field) => [
      field.key,
      field.kind === 'duration'
        ? ['', '']
        : field.kind === 'select'
          ? '不填'
          : '',
    ]),
  ])
}
