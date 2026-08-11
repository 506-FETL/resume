import type { RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { ResumeTemplateRuntime } from '@/components/resume/runtime/ResumeTemplateRuntime'
import { getBuiltInTemplateManifest } from '@/lib/resume-template/runtime/get-built-in-manifest'
import { getManifestFromTemplateBinding } from '@/lib/resume-template/runtime/get-manifest-from-binding'
import useResumeStore from '@/store/resume/form'
import ResumeWrapper from './resume-wrapper'

interface ResumePreviewProps {
  resumeRef: RefObject<HTMLDivElement | null>
  scrollContainerRef?: RefObject<HTMLDivElement | null>
}

export default function ResumePreview({ resumeRef, scrollContainerRef }: ResumePreviewProps) {
  const { type, templateBinding, basics, job_intent: jobIntent, application_info: applicationInfo, edu_background: eduBackground, work_experience: workExperience, internship_experience: internshipExperience, campus_experience: campusExperience, project_experience: projectExperience, skill_specialty: skillSpecialty, honors_certificates: honorsCertificates, self_evaluation: selfEvaluation, hobbies, order, visibility } = useResumeStore()

  const previewData = buildTemplateResumeData({
    basics,
    job_intent: jobIntent,
    application_info: applicationInfo,
    edu_background: eduBackground,
    work_experience: workExperience,
    internship_experience: internshipExperience,
    campus_experience: campusExperience,
    project_experience: projectExperience,
    skill_specialty: skillSpecialty,
    honors_certificates: honorsCertificates,
    self_evaluation: selfEvaluation,
    hobbies,
    order,
    type,
    templateBinding,
    visibility,
  })

  const [manifest, setManifest] = useState(() => getBuiltInTemplateManifest(type))

  useEffect(() => {
    let cancelled = false

    async function loadManifest() {
      const fallbackManifest = getBuiltInTemplateManifest(templateBinding?.basedOnResumeType ?? type)

      if (!templateBinding) {
        setManifest(fallbackManifest)
        return
      }

      try {
        const resolvedManifest = await getManifestFromTemplateBinding(templateBinding)
        if (!cancelled) {
          setManifest(resolvedManifest ?? fallbackManifest)
        }
      }
      catch {
        if (!cancelled) {
          setManifest(fallbackManifest)
        }
      }
    }

    loadManifest()

    return () => {
      cancelled = true
    }
  }, [templateBinding, type])

  // Scale-to-fit: shrink A4 content to viewport width on small screens
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [scaledSize, setScaledSize] = useState<{ w: number, h: number } | null>(null)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    if (!viewport || !canvas)
      return

    let frameId = 0

    const measure = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        const availableWidth = viewport.clientWidth
        const contentWidth = canvas.offsetWidth
        const contentHeight = canvas.offsetHeight
        if (!availableWidth || !contentWidth || !contentHeight) {
          setScale(1)
          setScaledSize(null)
          return
        }
        const nextScale = Math.min(1, availableWidth / contentWidth)
        setScale(prev => Math.abs(prev - nextScale) < 0.001 ? prev : nextScale)
        setScaledSize((prev) => {
          const w = contentWidth * nextScale
          const h = contentHeight * nextScale
          if (prev && Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1)
            return prev
          return { w, h }
        })
      })
    }

    const ro = new ResizeObserver(measure)
    ro.observe(viewport)
    ro.observe(canvas)
    measure()

    return () => {
      cancelAnimationFrame(frameId)
      ro.disconnect()
    }
  }, [previewData, manifest])

  return (
    <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto p-3 md:p-8">
      <div ref={viewportRef} className="w-full min-w-0">
        <div className="flex justify-center">
          <div
            className="relative"
            style={scaledSize
              ? { width: `${scaledSize.w}px`, height: `${scaledSize.h}px` }
              : undefined}
          >
            <div
              ref={canvasRef}
              className="absolute left-0 top-0 origin-top-left"
              style={{
                transform: `scale(${scale})`,
                width: 'fit-content',
                visibility: scaledSize ? 'visible' : 'hidden',
              }}
            >
              <ResumeWrapper ref={resumeRef}>
                <ResumeTemplateRuntime data={previewData} manifest={manifest} />
              </ResumeWrapper>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
