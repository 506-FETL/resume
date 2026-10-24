import type {
  TemplateAssetRef,
  TemplateSource,
} from '@/lib/resume-template/source/types'
import { create } from 'zustand'
import {
  asTemplateError,
  TemplateResolutionError,
} from '@/lib/resume-template/definition-schema'
import { resumeTemplateSource } from '@/lib/resume-template/source'

type TemplateImage =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error'; error: TemplateResolutionError }

export const IDLE_IMAGE = { status: 'idle' } as const

const MAX_IMAGES = 64
const MAX_IMAGE_BYTES = 64 * 1024 * 1024

interface ImageResources {
  images: Record<string, TemplateImage>
  load: (asset: TemplateAssetRef, force?: boolean) => Promise<void>
  retain: (hash: string, graceMs?: number) => () => void
}

/** 哈希标识不可变图片；下载、解码和 Blob URL 跨卡片、弹窗与编辑器共享。 */
export function createTemplateImageStore(source: TemplateSource) {
  const retained = new Map<string, number>()
  const recent = new Map<string, number>()
  const pending = new Map<string, Promise<void>>()

  return create<ImageResources>((set, get) => {
    function touch(hash: string, bytes = recent.get(hash) ?? 0) {
      recent.delete(hash)
      recent.set(hash, bytes)
    }

    function prune() {
      let bytes = [...recent.values()].reduce((total, size) => total + size, 0)
      const images = { ...get().images }
      let changed = false

      for (const [hash, size] of recent) {
        if (recent.size <= MAX_IMAGES && bytes <= MAX_IMAGE_BYTES) break
        if (retained.has(hash) || pending.has(hash)) continue

        const image = images[hash]

        if (image?.status === 'ready') URL.revokeObjectURL(image.url)

        delete images[hash]
        recent.delete(hash)
        bytes -= size
        changed = true
      }

      if (changed) set({ images })
    }

    function write(hash: string, image: TemplateImage) {
      set((state) => ({ images: { ...state.images, [hash]: image } }))
    }

    return {
      images: {},
      retain(hash, graceMs = 0) {
        retained.set(hash, (retained.get(hash) ?? 0) + 1)

        if (recent.has(hash)) touch(hash)

        let released = false

        return () => {
          if (released) return

          released = true

          const release = () => {
            const count = (retained.get(hash) ?? 1) - 1

            if (count > 0) retained.set(hash, count)
            else retained.delete(hash)

            prune()
          }

          // 打印副本可能在预览卸载后继续读取 URL，保留原有的释放宽限期。
          if (graceMs) setTimeout(release, graceMs)
          else release()
        }
      },
      load(asset, force = false) {
        const hash = asset.hash
        const current = get().images[hash]

        touch(hash)

        const existing = pending.get(hash)

        if (existing) return existing
        // 同一哈希的已验证图片无需强制刷新；重试只针对失败资源。
        if (
          current?.status === 'ready' ||
          (current?.status === 'error' && !force)
        )
          return Promise.resolve()

        write(hash, { status: 'loading' })

        const promise = (async () => {
          let url: string | undefined

          try {
            const blob = await source.getAsset(asset, { force })

            url = URL.createObjectURL(blob)

            const decoded = new Image()

            decoded.src = url
            await decoded.decode()

            if (
              decoded.naturalWidth !== asset.width ||
              decoded.naturalHeight !== asset.height
            )
              throw new TemplateResolutionError(
                'INVALID_DEFINITION',
                '模板图片尺寸与清单不符',
              )

            touch(hash, blob.size + asset.width * asset.height * 4)
            write(hash, { status: 'ready', url })
          } catch (error) {
            if (url) URL.revokeObjectURL(url)

            write(hash, { status: 'error', error: asTemplateError(error) })
          }
        })().finally(() => {
          pending.delete(hash)
          prune()
        })

        pending.set(hash, promise)

        return promise
      },
    }
  })
}

export const useTemplateImageStore =
  createTemplateImageStore(resumeTemplateSource)
