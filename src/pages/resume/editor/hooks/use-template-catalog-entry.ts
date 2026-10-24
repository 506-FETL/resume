import { useEffect } from 'react'
import { useTemplateCatalogDetails } from '../template-switch/const'

export function useTemplateCatalogEntry(templateId?: string) {
  const detail = useTemplateCatalogDetails((state) =>
    templateId ? state.entries[templateId] : undefined,
  )

  const error = useTemplateCatalogDetails((state) =>
    templateId ? state.errors[templateId] : undefined,
  )

  const load = useTemplateCatalogDetails((state) => state.load)

  useEffect(() => {
    if (templateId) load(templateId)
  }, [templateId, load])

  return { ...detail, error }
}
