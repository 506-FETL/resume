import { useEffect } from 'react'
import { useExperienceSourcesStore } from '@/store/experience-sources'

export function useSourceMetadata(sourceIds: string[]) {
  const metadata = useExperienceSourcesStore((state) => state.metadata)
  const generation = useExperienceSourcesStore((state) => state.generation)
  const revision = useExperienceSourcesStore((state) => state.revision)
  const key = [...new Set(sourceIds)].sort().join(',')

  useEffect(() => {
    if (key)
      useExperienceSourcesStore.getState().resolveMetadata(key.split(','))
  }, [key, generation, revision])

  return metadata
}
