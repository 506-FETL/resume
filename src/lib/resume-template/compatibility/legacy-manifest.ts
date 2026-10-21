import { z } from 'zod'

export const templateOwnerTypeEnum = z.enum(['official', 'user'])
export const templateVisibilityEnum = z.enum(['private', 'published'])
export const templateStatusEnum = z.enum(['draft', 'active', 'archived'])
export const templateSkeletonEnum = z.enum(['single-column', 'sidebar-left', 'sidebar-right', 'stacked'])
export const templateDensityEnum = z.enum(['compact', 'normal', 'comfortable'])
export const templateSectionRegionEnum = z.enum(['main', 'sidebar'])

export const templateSectionSchema = z.object({
  sectionId: z.string(),
  renderer: z.string(),
  region: templateSectionRegionEnum,
  order: z.number().int(),
  visible: z.boolean(),
  variant: z.string().optional(),
})

export const templateManifestSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  familyId: z.string(),
  meta: z.object({
    name: z.string(),
    description: z.string().optional(),
    ownerType: templateOwnerTypeEnum,
    ownerId: z.string().optional(),
    visibility: templateVisibilityEnum,
    status: templateStatusEnum,
  }),
  layout: z.object({
    skeleton: templateSkeletonEnum.or(z.string()),
    headerVariant: z.string(),
    density: templateDensityEnum,
    page: z.object({
      size: z.enum(['A4']),
      pagePaddingToken: z.string(),
    }),
  }),
  sections: z.array(templateSectionSchema),
  tokens: z.object({
    colorPreset: z.string(),
    fontPreset: z.string(),
    spacingPreset: z.string(),
    radiusPreset: z.string().optional(),
  }),
  rules: z.object({
    requiredSections: z.array(z.string()).optional(),
    lockedSections: z.array(z.string()).optional(),
    allowedRegions: z.record(z.string(), z.array(templateSectionRegionEnum)).optional(),
  }),
})

export type LegacyTemplateManifest = z.infer<typeof templateManifestSchema>
