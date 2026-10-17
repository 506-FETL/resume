import { ArrowUpRightIcon, CircleSlashIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Globe } from '@/components/ui/globe'
import { Highlighter } from '@/components/ui/highlighter'
import { LightRays } from '@/components/ui/light-rays'
import { useIsMobile } from '@/hooks/use-mobile'

export default function NotFound() {
  const isMobile = useIsMobile()

  return (
    <Empty className="relative h-full overflow-hidden">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleSlashIcon />
        </EmptyMedia>
        <EmptyTitle>
          <Highlighter action="underline">
            <span className="text-xl font-bold text-foreground">404</span>
          </Highlighter>
        </EmptyTitle>
        <EmptyDescription>
          您访问的页面不存在
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="link" asChild className="text-muted-foreground" size="sm">
          <Link to="/">
            回到首页
            <ArrowUpRightIcon />
          </Link>
        </Button>
      </EmptyContent>
      {!isMobile && <LightRays length="100vh" />}
      <Globe className="top-3/4" />
    </Empty>
  )
}
