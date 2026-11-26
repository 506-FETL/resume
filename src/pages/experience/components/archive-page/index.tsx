import { useLayoutEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PageLayout } from '@/components/layout/page-layout'
import { DeferredExperienceUploadDialog } from '@/features/experience-sources/deferred-upload-dialog'
import { getExperienceTarget } from '@/lib/experience-route'
import { useExperienceSourcesStore } from '@/store/experience-sources'
import { useExperiencePageStore } from '../../store'
import ExperienceWorkspace from '../workspace'

export default function ExperiencePage() {
  const generation = useExperienceSourcesStore((state) => state.generation)

  return <Archive key={generation} />
}

function Archive() {
  const location = useLocation()

  const target = useMemo(
    () => getExperienceTarget(location.search, location.state),
    [location.search, location.state],
  )

  const [initialized, setInitialized] = useState(!target)
  const uploadOpen = useExperiencePageStore((state) => state.uploadOpen)
  const uploadTab = useExperiencePageStore((state) => state.uploadTab)

  useLayoutEffect(() => {
    if (target)
      useExperiencePageStore
        .getState()
        .select(target.sourceId, target.versionId, target.blockId)

    setInitialized(true)
  }, [location.key, target])

  return (
    <PageLayout workspace>
      {initialized && <ExperienceWorkspace />}
      <DeferredExperienceUploadDialog
        open={uploadOpen}
        onOpenChange={useExperiencePageStore.getState().setUploadOpen}
        initialTab={uploadTab}
        onComplete={useExperiencePageStore.getState().finishUpload}
      />
    </PageLayout>
  )
}
