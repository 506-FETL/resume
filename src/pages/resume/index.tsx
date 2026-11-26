import { lazy, useState } from 'react'
import { resumeLibraryPage } from '@/lib/resume-library-route'

const DeferredPage = lazy(resumeLibraryPage.load)

export default function ResumeLibraryEntry() {
  const [Page] = useState(() => resumeLibraryPage.ready ?? DeferredPage)

  return <Page />
}
