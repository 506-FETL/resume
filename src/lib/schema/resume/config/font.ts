import { z } from 'zod'

export const RESUME_FONT_FAMILIES = {
  sans: 'noto-sans-sc',
  serif: 'noto-serif-sc',
  wenkai: 'lxgw-wenkai',
} as const

export const DEFAULT_RESUME_FONT_FAMILY_NAME = 'Noto Sans SC Variable'

export const fontFamilyOptions = [
  { label: '无衬线', value: RESUME_FONT_FAMILIES.sans },
  { label: '衬线', value: RESUME_FONT_FAMILIES.serif },
  { label: '文楷', value: RESUME_FONT_FAMILIES.wenkai },
] as const

export const fontFamilyEnum = z.enum([
  RESUME_FONT_FAMILIES.sans,
  RESUME_FONT_FAMILIES.serif,
  RESUME_FONT_FAMILIES.wenkai,
])

export type ResumeFontFamily = z.infer<typeof fontFamilyEnum>

const LEGACY_FONT_FAMILY_MAP: Record<string, ResumeFontFamily> = {
  'system': RESUME_FONT_FAMILIES.sans,
  'Microsoft YaHei': RESUME_FONT_FAMILIES.sans,
  'SimHei': RESUME_FONT_FAMILIES.sans,
  'Arial': RESUME_FONT_FAMILIES.sans,
  'SimSun': RESUME_FONT_FAMILIES.serif,
  'Times New Roman': RESUME_FONT_FAMILIES.serif,
  'Georgia': RESUME_FONT_FAMILIES.serif,
  'KaiTi': RESUME_FONT_FAMILIES.wenkai,
}

export function normalizeResumeFontFamily(value: unknown): ResumeFontFamily {
  const parsed = fontFamilyEnum.safeParse(value)
  if (parsed.success)
    return parsed.data
  if (typeof value === 'string')
    return LEGACY_FONT_FAMILY_MAP[value] ?? RESUME_FONT_FAMILIES.sans
  return RESUME_FONT_FAMILIES.sans
}

export const fontSizeOptions = [
  { label: '小号 (12px)', value: 12 },
  { label: '正常 (14px)', value: 14 },
  { label: '中等 (16px)', value: 16 },
  { label: '大号 (18px)', value: 18 },
  { label: '特大 (20px)', value: 20 },
] as const

export const fontConfigSchema = z.object({
  fontFamily: fontFamilyEnum.default(RESUME_FONT_FAMILIES.sans),
  fontSize: z.number().min(10).max(24).default(14),
})

export type FontConfigType = z.infer<typeof fontConfigSchema>

export const DEFAULT_FONT_CONFIG: FontConfigType = {
  fontFamily: RESUME_FONT_FAMILIES.sans,
  fontSize: 14,
}

export function getFontFamilyName(fontFamily: ResumeFontFamily) {
  switch (fontFamily) {
    case RESUME_FONT_FAMILIES.serif:
      return 'Noto Serif SC Variable'
    case RESUME_FONT_FAMILIES.wenkai:
      return 'LXGW WenKai'
    default:
      return DEFAULT_RESUME_FONT_FAMILY_NAME
  }
}

export function getFontFamilyCSS(fontFamily: ResumeFontFamily) {
  const familyName = getFontFamilyName(fontFamily)
  const generic = fontFamily === RESUME_FONT_FAMILIES.serif ? 'serif' : 'sans-serif'
  return `'${familyName}', ${generic}`
}

export function getResumeFontWeights(fontFamily: ResumeFontFamily) {
  return fontFamily === RESUME_FONT_FAMILIES.wenkai
    ? { normal: 500, medium: 500, bold: 700 }
    : { normal: 400, medium: 600, bold: 700 }
}
