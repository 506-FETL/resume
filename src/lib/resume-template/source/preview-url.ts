import type { TemplateAssetRef } from './types'
import { assetRefSchema } from './catalog-schema'

/** 预览 URL 只由可信项目地址与已校验的内容哈希组成。 */
export function templatePreviewUrl(
  projectUrl: string,
  asset: TemplateAssetRef,
): string {
  const { hash } = assetRefSchema.parse(asset)

  return new URL(
    `/storage/v1/object/public/resume-template-previews/${hash}`,
    projectUrl,
  ).href
}

export const getTemplatePreviewUrl = (asset: TemplateAssetRef) =>
  templatePreviewUrl(import.meta.env.VITE_SUPABASE_URL, asset)
