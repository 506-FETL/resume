import type { TemplateWorkbenchTab } from '../../store'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TEMPLATE_CENTER_TAB_META } from '../../const'
import { useOfficialTemplatesStore, useTemplateWorkbenchStore, useUserTemplatesStore } from '../../store'
import { OfficialTemplateSection } from './official-template-section'
import { UserTemplateSection } from './user-template-section'

const WORKBENCH_TAB_ORDER: TemplateWorkbenchTab[] = ['official', 'mine']

function TemplateWorkbench() {
  const { activeTab, setTab } = useTemplateWorkbenchStore()
  const { officialTemplates } = useOfficialTemplatesStore()
  const { userTemplates } = useUserTemplatesStore()
  const tabCounts: Record<TemplateWorkbenchTab, number> = {
    official: officialTemplates.length,
    mine: userTemplates.length,
  }
  const tabItems = WORKBENCH_TAB_ORDER.map(key => ({
    key,
    count: tabCounts[key],
    ...TEMPLATE_CENTER_TAB_META[key],
  }))

  return (
    <Card>
      <CardContent>
        <Tabs value={activeTab} onValueChange={value => setTab(value as TemplateWorkbenchTab)} className="gap-5">
          <TabsList>
            {tabItems.map((tab) => {
              const Icon = tab.icon

              return (
                <TabsTrigger key={tab.key} value={tab.key}>
                  <div className="flex items-center gap-3">
                    <Icon />
                    <span className="truncate">{tab.label}</span>
                    <Badge variant="secondary" className="ml-auto">{tab.count}</Badge>
                  </div>
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value="official">
            <OfficialTemplateSection />
          </TabsContent>

          <TabsContent value="mine">
            <UserTemplateSection />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default TemplateWorkbench
