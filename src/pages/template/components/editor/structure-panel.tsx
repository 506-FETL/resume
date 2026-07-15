import type { DropResult } from '@hello-pangea/dnd'
import type { TemplateSection } from '@/lib/resume-template/schema'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { Layers3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { TEMPLATE_SECTION_LABELS } from '../../const'
import { useTemplateEditorStore } from '../../store'
import { moveSectionRegion, reorderSections, toggleSectionVisibility } from '../../utils'
import { TemplateSectionPalette } from './section-palette'

function reorderIds(items: TemplateSection[], sourceIndex: number, destinationIndex: number) {
  const next = [...items.map(item => item.sectionId)]
  const [removed] = next.splice(sourceIndex, 1)
  next.splice(destinationIndex, 0, removed)
  return next
}

function SectionList({
  droppableId,
  label,
  items,
  selectedSectionId,
  onSelectSection,
  onToggleVisible,
}: {
  droppableId: TemplateSection['region']
  label: string
  items: TemplateSection[]
  selectedSectionId: string | null
  onSelectSection: (sectionId: string | null) => void
  onToggleVisible: (sectionId: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">{label}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>

      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'min-h-30 space-y-2 rounded-2xl border border-dashed p-3 transition-colors',
              snapshot.isDraggingOver ? 'border-primary bg-primary/5' : 'border-border/70',
            )}
          >
            {items.length > 0
              ? items.map((section, index) => (
                  <Draggable key={section.sectionId} draggableId={section.sectionId} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className={cn(
                          'rounded-xl border bg-card p-3 shadow-sm transition-all',
                          selectedSectionId === section.sectionId && 'border-primary ring-2 ring-primary/10',
                          dragSnapshot.isDragging && 'rotate-1 shadow-md',
                        )}
                        onClick={() => onSelectSection(
                          selectedSectionId === section.sectionId ? null : section.sectionId,
                        )}
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
                            onCheckedChange={() => onToggleVisible(section.sectionId)}
                            onClick={event => event.stopPropagation()}
                          />
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))
              : (
                  <div className="rounded-xl bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
                    拖动模块到这里
                  </div>
                )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

export function TemplateStructurePanel() {
  const { manifestDraft: manifest, selectedSectionId, setSelectedSection, applyManifest } = useTemplateEditorStore()

  if (!manifest) {
    return null
  }

  const mainSections = manifest.sections.filter(section => section.region === 'main')
  const sidebarSections = manifest.sections.filter(section => section.region === 'sidebar')

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) {
      return
    }

    if (source.droppableId === destination.droppableId) {
      const sections = source.droppableId === 'main' ? mainSections : sidebarSections
      const orderedSectionIds = reorderIds(sections, source.index, destination.index)
      applyManifest(reorderSections(manifest, source.droppableId as TemplateSection['region'], orderedSectionIds))
      return
    }

    applyManifest(
      moveSectionRegion(
        manifest,
        draggableId,
        destination.droppableId as TemplateSection['region'],
        destination.index,
      ),
    )
  }

  return (
    <Card className="max-h-[69vh] overflow-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers3 className="size-4 shrink-0" />
          结构面板
        </CardTitle>
        <CardDescription>拖拽排序、切换区域，决定模板的整体结构。</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <div>
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-6">
              <SectionList
                droppableId="main"
                label="主栏"
                items={mainSections}
                selectedSectionId={selectedSectionId}
                onSelectSection={setSelectedSection}
                onToggleVisible={sectionId => applyManifest(toggleSectionVisibility(manifest, sectionId))}
              />

              <SectionList
                droppableId="sidebar"
                label="侧栏"
                items={sidebarSections}
                selectedSectionId={selectedSectionId}
                onSelectSection={setSelectedSection}
                onToggleVisible={sectionId => applyManifest(toggleSectionVisibility(manifest, sectionId))}
              />
            </div>
          </DragDropContext>

          <div className="mt-6 flex flex-col gap-3">
            <h3 className="font-medium">模块库</h3>
            <TemplateSectionPalette manifest={manifest} onChange={applyManifest} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
