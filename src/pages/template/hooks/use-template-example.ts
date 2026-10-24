import type { ExampleRef } from '@/lib/resume-template/source/types'
import { useEffect } from 'react'
import { exampleKey } from '@/lib/resume-template/source/types'
import { useResumeTemplateStore } from '@/store/resume-template'

export function useTemplateExample(ref: ExampleRef) {
  const resource = useResumeTemplateStore(
    (state) => state.examples[exampleKey(ref)],
  )
  const load = useResumeTemplateStore((state) => state.loadExample)
  const retain = useResumeTemplateStore((state) => state.retainExample)
  const { exampleId, version } = ref
  useEffect(() => {
    const release = retain({ exampleId, version })
    load({ exampleId, version })
    return release
  }, [load, retain, exampleId, version])
  return { resource, retry: () => load(ref, true) }
}
