import { useExperienceSourcesStore } from '@/store/experience-sources'
import type { ExperienceSourceReadResult } from './types'
import { readExperienceSource } from './api'
import type { readExperienceFile } from './read-file'

type FileContent = Awaited<ReturnType<typeof readExperienceFile>>

export type ExperienceContentResult = ExperienceSourceReadResult & {
  warning?: string
}

const contents = new WeakMap<Blob, Promise<FileContent>>()

export async function readExperienceContent(options: {
  sourceId: string
  versionId?: string
  offset?: number
  limit?: number
  all?: boolean
  blockIds?: string[]
  signal?: AbortSignal
  refresh?: boolean
  onMetadata?: (result: ExperienceSourceReadResult) => void
}): Promise<ExperienceContentResult> {
  const { sourceId, versionId, offset = 0, limit = 20, blockIds } = options
  const state = useExperienceSourcesStore.getState()
  const controller = new AbortController()
  const abort = () => controller.abort()

  const interrupted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      'abort',
      () => reject(controller.signal.reason),
      { once: true },
    )
  })

  const wait = <T>(request: Promise<T>) => Promise.race([request, interrupted])

  const unsubscribe = useExperienceSourcesStore.subscribe((next) => {
    if (
      next.generation !== state.generation ||
      next.revision !== state.revision
    )
      abort()
  })

  options.signal?.addEventListener('abort', abort, { once: true })

  try {
    options.signal?.throwIfAborted()

    const result = await wait(
      state.read(sourceId, versionId, 0, options.refresh),
    )

    controller.signal.throwIfAborted()
    options.onMetadata?.(result)

    if (result.version.blockCount > 0 || !result.version.fileName) {
      if (options.all) {
        const pages: ExperienceSourceReadResult[] = [result]

        const offsets = Array.from(
          { length: Math.ceil(result.version.blockCount / 20) - 1 },
          (_, index) => (index + 1) * 20,
        )

        for (let index = 0; index < offsets.length; index += 3) {
          controller.signal.throwIfAborted()

          pages.push(
            ...(await wait(
              Promise.all(
                offsets
                  .slice(index, index + 3)
                  .map((pageOffset) =>
                    state.read(sourceId, result.version.id, pageOffset),
                  ),
              ),
            )),
          )
        }

        controller.signal.throwIfAborted()

        return {
          ...result,
          blocks: pages.flatMap((page) => page.blocks),
          hasMore: false,
        }
      }

      if (offset || blockIds) {
        const page = await wait(
          readExperienceSource({
            sourceId,
            versionId: result.version.id,
            offset,
            limit,
            blockIds,
            signal: controller.signal,
          }),
        )

        controller.signal.throwIfAborted()

        return page
      }

      return {
        ...result,
        blocks: result.blocks.slice(0, limit),
        hasMore: result.hasMore || result.blocks.length > limit,
      }
    }

    const blob = await wait(state.original(sourceId, result.version.id))

    controller.signal.throwIfAborted()

    const content = await wait(loadFileContent(blob, result.version.fileName))

    controller.signal.throwIfAborted()

    const blocks = blockIds
      ? content.blocks.filter((block) => blockIds.includes(block.id))
      : options.all
        ? content.blocks
        : content.blocks.slice(offset, offset + limit)

    if (blockIds?.some((id) => !blocks.some((block) => block.id === id)))
      throw new Error('引用的原文段落不存在。')

    return {
      ...result,
      version: {
        ...result.version,
        textLength: content.text.length,
        blockCount: content.blocks.length,
      },
      blocks,
      hasMore:
        !options.all &&
        !blockIds &&
        offset + blocks.length < content.blocks.length,
      warning: content.warning,
    }
  } finally {
    options.signal?.removeEventListener('abort', abort)
    unsubscribe()
  }
}

function loadFileContent(blob: Blob, fileName: string) {
  const cached = contents.get(blob)

  if (cached) return cached

  const state = useExperienceSourcesStore.getState()
  const controller = new AbortController()

  const unsubscribe = useExperienceSourcesStore.subscribe((next) => {
    if (
      next.generation !== state.generation ||
      next.revision !== state.revision
    )
      controller.abort()
  })

  // 多个读者共用解析；单个读者退出不取消其他读者，账户或资料变化则共同取消。
  const request = import('./read-file')
    .then(({ readExperienceFile }) => {
      controller.signal.throwIfAborted()

      return readExperienceFile(blob, fileName, controller.signal)
    })
    .then((result) => {
      controller.signal.throwIfAborted()

      return result
    })
    .catch((error: unknown) => {
      contents.delete(blob)

      throw error
    })
    .finally(unsubscribe)

  contents.set(blob, request)

  return request
}
