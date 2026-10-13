import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatedContent } from '@/components/motion/animated-content'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import TemplateEditor from './components/editor'
import TemplateWorkbench from './components/workbench'
import WorkbenchHero from './components/workbench/workbench-hero'
import { TEMPLATE_CENTER_SUMMARY_ITEMS } from './const'
import { useTemplateEditorStore, useTemplateWorkbenchStore } from './store'

function Template() {
  const navigate = useNavigate()
  const { mode, loading, error, setNavigate, loadTemplates } = useTemplateWorkbenchStore()
  const { dirty } = useTemplateEditorStore()

  useEffect(() => {
    setNavigate(navigate)
    return () => setNavigate(null)
  }, [navigate, setNavigate])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (!dirty) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  return (
    <AnimatedContent animationKey={loading ? 'loading' : mode}>
      {loading
        ? <TemplateLibraryLoadingState />
        : mode === 'editor'
          ? <TemplateEditor />
          : (
              <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:gap-8">
                <WorkbenchHero />

                {error && (
                  <Card className="border-destructive/35 bg-destructive/5">
                    <CardHeader className="gap-2">
                      <Badge variant="destructive">模板加载失败</Badge>
                      <CardTitle className="text-base">社区模板或我的模板暂时不可用</CardTitle>
                      <CardDescription>{error}</CardDescription>
                    </CardHeader>
                  </Card>
                )}

                <TemplateWorkbench />
              </div>
            )}
    </AnimatedContent>
  )
}

function TemplateLibraryLoadingState() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 p-6 lg:gap-8">
      <Card className="overflow-hidden border-border/70">
        <CardHeader className="gap-4">
          <Skeleton className="h-6 w-20 rounded-full" />
        </CardHeader>

        <CardContent className="flex flex-col gap-6">

          <div className="grid gap-3 md:grid-cols-3">
            {TEMPLATE_CENTER_SUMMARY_ITEMS.map(item => (
              <div key={item.key} className="rounded-2xl border bg-background/70 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-9 rounded-xl" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full max-w-45" />
                  </div>
                </div>
                <Skeleton className="mt-4 h-8 w-14" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2].map(key => (
              <Skeleton key={key} className="h-10 w-32 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-4 w-56" />
        </CardHeader>

        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map(key => (
              <div key={key} className="rounded-2xl border bg-background/70 p-4 shadow-sm">
                <Skeleton className="aspect-4/5 w-full rounded-xl" />
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Template
