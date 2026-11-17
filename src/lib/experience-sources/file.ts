import { EXPERIENCE_EXTRACTOR_VERSION, EXPERIENCE_MAX_BYTES } from './const'
import type { ExtractedExperienceFile } from './types'
import { ExperienceSourceError } from './types'

export function prepareExperienceFile(file: File): ExtractedExperienceFile {
  if (file.size > EXPERIENCE_MAX_BYTES)
    throw new ExperienceSourceError('文件超过 10 MB，请重新选择。', 'too_large')

  return {
    text: '',
    blocks: [],
    kind: 'file',
    sourceName: file.name,
    extractorVersion: EXPERIENCE_EXTRACTOR_VERSION,
  }
}
