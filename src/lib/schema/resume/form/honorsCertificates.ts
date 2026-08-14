import { z } from 'zod'
import { resumeEntryIdSchema } from '../entry-id'

// 预设荣誉证书
export const PRESET_CERTIFICATES = [
  '英语四级',
  '英语六级',
  '计算机一级',
  '计算机二级',
  '计算机三级',
  '计算机四级',
  '普通话一级',
  '普通话二级',
  '王者荣耀春季赛10强',
  '10大肖年领军人才',
] as const

export type PresetCertificate = (typeof PRESET_CERTIFICATES)[number]

export const certificateItemSchema = z.object({
  entryId: resumeEntryIdSchema,
  name: z.string().trim(),
})

const certificatesListSchema = z.array(certificateItemSchema)

export const honorsCertificatesFormSchema = z.object({
  description: z.string().trim(),
  certificates: certificatesListSchema,
})

export type HonorsCertificatesFormType = z.infer<typeof honorsCertificatesFormSchema>
export type CertificateItem = z.infer<typeof certificateItemSchema>
export const DEFAULT_HONORS_CERTIFICATES: HonorsCertificatesFormType = {
  description: '',
  certificates: [],
}
