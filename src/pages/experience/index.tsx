import { lazy, useState } from 'react'
import { experiencePage } from '@/lib/experience-route'

const DeferredPage = lazy(experiencePage.load)

export default function ExperienceEntry() {
  const [Page] = useState(() => experiencePage.ready ?? DeferredPage)

  return <Page />
}
