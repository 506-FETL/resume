import type { TemplateCardSummary } from '@/lib/resume-template/source/types'
import type { CatalogState } from './catalog'
import { create } from 'zustand'
import { galleryCatalogSource } from '@/lib/resume-template/source/gallery'
import { createCatalogActions } from './catalog'

export const useTemplateGalleryCatalog = create<
  CatalogState<TemplateCardSummary>
>((set, get) => createCatalogActions(galleryCatalogSource, set, get))
