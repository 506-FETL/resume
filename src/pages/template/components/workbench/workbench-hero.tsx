import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TEMPLATE_CENTER_SUMMARY_ITEMS } from '../../const'
import { useOfficialTemplatesStore, useUserTemplatesStore } from '../../store'

export default function WorkbenchHero() {
  const { officialTemplates } = useOfficialTemplatesStore()
  const { userTemplates } = useUserTemplatesStore()

  const summaryCounts = {
    official: officialTemplates.length,
    mine: userTemplates.length,
  }

  return (
    <Card className="overflow-hidden border-border/70 bg-linear-to-br from-primary/6 via-background to-secondary/25">
      <CardHeader>
        <CardTitle className="text-2xl sm:text-3xl">
          模板中心
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">

        <div className="grid gap-3 md:grid-cols-2">
          {TEMPLATE_CENTER_SUMMARY_ITEMS.map((item) => {
            const Icon = item.icon

            return (
              <div key={item.key} className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{item.description}</p>
                  </div>
                </div>

                <p className="mt-4 text-3xl font-semibold tracking-tight">{summaryCounts[item.key]}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
