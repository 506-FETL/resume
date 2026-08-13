import type { RefObject } from 'react'
import type { TemplateSection } from '@/lib/resume-template/schema'
import { Layers3 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CrossListDragProvider,
  useCrossListContainer,
  useCrossListItem,
} from '@/components/ui/cross-list-drag'
import { Switch } from '@/components/ui/switch'
import { moveArrayItem } from '@/lib/motion-drag'
import { cn } from '@/lib/utils'
import { TEMPLATE_SECTION_LABELS } from '../../const'
import { useTemplateEditorStore } from '../../store'
import { moveSectionRegion, reorderSections, toggleSectionVisibility } from '../../utils'
import { TemplateSectionPalette } from './section-palette'

function SectionCard({
  section,
  containerId,
  index,
  selected,
  onSelect,
  onToggleVisible,
}: {
  section: TemplateSection
  containerId: TemplateSection['region']
  index: number
  selected: boolean
  onSelect: () => void
  onToggleVisible: () => void
}) {
  const reduceMotion = useReducedMotion()
  const { dragging, getDragProps } = useCrossListItem({
    id: section.sectionId,
    containerId,
    index,
  })

  return (
    <motion.div
      {...getDragProps()}
      layout="position"
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
      className={cn(
        'cursor-grab rounded-xl border bg-card p-3 shadow-sm transition-[border-color,box-shadow,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing',
        selected && 'border-primary ring-2 ring-primary/10',
        dragging && 'opacity-35',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {TEMPLATE_SECTION_LABELS[section.renderer] ?? section.renderer}
          </p>
          <p className="text-xs text-muted-foreground">{section.sectionId}</p>
        </div>
        <Switch
          checked={section.visible}
          onCheckedChange={onToggleVisible}
          onClick={event => event.stopPropagation()}
          data-no-drag=""
        />
      </div>
    </motion.div>
  )
}

function DropIndicator() {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      aria-hidden="true"
      initial={reduceMotion ? false : { opacity: 0, scaleX: 0.8 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.12 }}
      className="pointer-events-none h-0.5 rounded-full bg-primary"
    />
  )
}

function SectionList({
  containerId,
  label,
  items,
  selectedSectionId,
  scrollRef,
  onSelectSection,
  onToggleVisible,
}: {
  containerId: TemplateSection['region']
  label: string
  items: TemplateSection[]
  selectedSectionId: string | null
  scrollRef: RefObject<HTMLElement | null>
  onSelectSection: (sectionId: string | null) => void
  onToggleVisible: (sectionId: string) => void
}) {
  const itemIds = useMemo(() => items.map(item => item.sectionId), [items])
  const {
    ref,
    active,
    destinationIndex,
    activeSourceId,
    activeSourceIndex,
  } = useCrossListContainer({
    id: containerId,
    label,
    itemIds,
    axis: 'y',
    scrollRef,
  })
  const visualDestinationIndex = active
    && destinationIndex !== null
    && activeSourceId === containerId
    && activeSourceIndex !== null
    && destinationIndex > activeSourceIndex
    ? destinationIndex + 1
    : destinationIndex

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">{label}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>

      <div
        ref={ref}
        role="list"
        aria-label={`${label}模块`}
        data-motion-drop-container={containerId}
        className={cn(
          'flex min-h-30 flex-col gap-2 rounded-2xl border border-dashed p-3 transition-colors',
          active ? 'border-primary bg-primary/5' : 'border-border/70',
        )}
      >
        {items.length > 0
          ? items.map((section, index) => (
              <div key={section.sectionId} className="contents">
                {active && visualDestinationIndex === index && <DropIndicator />}
                <SectionCard
                  section={section}
                  containerId={containerId}
                  index={index}
                  selected={selectedSectionId === section.sectionId}
                  onSelect={() => onSelectSection(
                    selectedSectionId === section.sectionId ? null : section.sectionId,
                  )}
                  onToggleVisible={() => onToggleVisible(section.sectionId)}
                />
              </div>
            ))
          : (
              <div className="rounded-xl bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
                拖动模块到这里
              </div>
            )}
        {active && visualDestinationIndex === items.length && <DropIndicator />}
      </div>
    </div>
  )
}

function SectionOverlay({ section }: { section: TemplateSection }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-xl ring-1 ring-primary/20">
      <p className="truncate font-medium">
        {TEMPLATE_SECTION_LABELS[section.renderer] ?? section.renderer}
      </p>
      <p className="text-xs text-muted-foreground">{section.sectionId}</p>
    </div>
  )
}

export function TemplateStructurePanel() {
  const { manifestDraft: manifest, selectedSectionId, setSelectedSection, applyManifest } = useTemplateEditorStore()
  const scrollRef = useRef<HTMLDivElement | null>(null)

  if (!manifest)
    return null

  const mainSections = manifest.sections.filter(section => section.region === 'main')
  const sidebarSections = manifest.sections.filter(section => section.region === 'sidebar')
  const scrollAreas = [{ ref: scrollRef, axis: 'y' as const }]

  const handleDrop = ({
    itemId,
    destinationId,
    destinationIndex,
  }: {
    itemId: string
    sourceId: string
    sourceIndex: number
    destinationId: string
    destinationIndex: number
  }) => {
    const latestManifest = useTemplateEditorStore.getState().manifestDraft
    if (!latestManifest)
      return

    const sourceSection = latestManifest.sections.find(section => section.sectionId === itemId)
    if (!sourceSection)
      return

    const sourceRegion = sourceSection.region
    const destinationRegion = destinationId as TemplateSection['region']
    if (sourceRegion === destinationRegion) {
      const sections = latestManifest.sections.filter(section => section.region === sourceRegion)
      const latestSourceIndex = sections.findIndex(section => section.sectionId === itemId)
      if (latestSourceIndex < 0)
        return
      const orderedSectionIds = moveArrayItem(
        sections.map(section => section.sectionId),
        latestSourceIndex,
        destinationIndex,
      )
      if (orderedSectionIds.some((id, index) => id !== sections[index]?.sectionId))
        applyManifest(reorderSections(latestManifest, sourceRegion, orderedSectionIds))
      return
    }

    applyManifest(moveSectionRegion(latestManifest, itemId, destinationRegion, destinationIndex))
  }

  return (
    <Card ref={scrollRef} className="max-h-[69vh] overflow-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers3 className="size-4 shrink-0" />
          结构面板
        </CardTitle>
        <CardDescription>拖拽排序、切换区域，决定模板的整体结构。</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <CrossListDragProvider
          onDrop={handleDrop}
          scrollAreas={scrollAreas}
          renderOverlay={(sectionId) => {
            const section = manifest.sections.find(item => item.sectionId === sectionId)
            return section ? <SectionOverlay section={section} /> : null
          }}
        >
          <div className="flex flex-col gap-6">
            <SectionList
              containerId="main"
              label="主栏"
              items={mainSections}
              selectedSectionId={selectedSectionId}
              scrollRef={scrollRef}
              onSelectSection={setSelectedSection}
              onToggleVisible={sectionId => applyManifest(toggleSectionVisibility(manifest, sectionId))}
            />

            <SectionList
              containerId="sidebar"
              label="侧栏"
              items={sidebarSections}
              selectedSectionId={selectedSectionId}
              scrollRef={scrollRef}
              onSelectSection={setSelectedSection}
              onToggleVisible={sectionId => applyManifest(toggleSectionVisibility(manifest, sectionId))}
            />
          </div>
        </CrossListDragProvider>

        <div className="mt-6 flex flex-col gap-3">
          <h3 className="font-medium">模块库</h3>
          <TemplateSectionPalette manifest={manifest} onChange={applyManifest} />
        </div>
      </CardContent>
    </Card>
  )
}
