import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PageLayout } from '@/components/layout/page-layout'
import { ExperienceUploadDialog } from '@/features/experience-sources'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import ExperienceWorkspace from './components/workspace'
import { useExperiencePageStore } from './store'
import type { ExperienceLocationState } from './types'

export default function ExperiencePage() {
  const location = useLocation()
  const generation = useExperienceSourcesStore((state) => state.generation)
  const uploadOpen = useExperiencePageStore((state) => state.uploadOpen)
  const uploadTab = useExperiencePageStore((state) => state.uploadTab)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const state = location.state as ExperienceLocationState | null

    const target = params.has('sourceId')
      ? {
          sourceId: params.get('sourceId'),
          versionId: params.get('versionId'),
          blockId: params.get('blockId'),
        }
      : state

    if (typeof target?.sourceId !== 'string' || !target.sourceId) return

    useExperiencePageStore
      .getState()
      .select(
        target.sourceId,
        typeof target.versionId === 'string' ? target.versionId : undefined,
        typeof target.blockId === 'string' ? target.blockId : undefined,
      )
  }, [location.key, location.state, location.search, generation])

  return (
    <PageLayout workspace>
      <ExperienceWorkspace key={generation} />
      <ExperienceUploadDialog
        open={uploadOpen}
        onOpenChange={useExperiencePageStore.getState().setUploadOpen}
        initialTab={uploadTab}
        onComplete={useExperiencePageStore.getState().finishUpload}
      />
    </PageLayout>
  )
}
