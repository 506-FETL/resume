import { StarIcon } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'
import { Fragment } from 'react/jsx-runtime'
import { GithubStars, GithubStarsIcon, GithubStarsNumber, GithubStarsParticles } from '@/components/animate-ui/primitives/animate/github-stars'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import ResumeConfigToolbar from '@/pages/resume/editor/components/toolbar'
import { AnimatedThemeToggler } from '../ui/animated-theme-toggler'

export function SiteHeader() {
  const reduceMotion = useReducedMotion()
  const crumbs = useBreadcrumbs()
  const location = useLocation()
  const isResumeEditor = location.pathname.startsWith('/resume/editor')

  return (
    <div className="relative flex w-full min-w-0 items-center gap-1 px-2 sm:px-4 lg:gap-2">
      <SidebarTrigger className="-ml-1 shrink-0" aria-label="切换导航栏" />
      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb className={cn('min-w-0', isResumeEditor && 'hidden xl:block')}>
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, idx) => (
            <Fragment key={crumb.href}>
              <BreadcrumbItem className={cn('min-w-0', idx < crumbs.length - 1 && 'hidden md:block')}>
                {idx === crumbs.length - 1
                  ? <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  : <BreadcrumbLink asChild><Link to={crumb.href} className="whitespace-nowrap">{crumb.label}</Link></BreadcrumbLink>}
              </BreadcrumbItem>
              {idx < crumbs.length - 1 && <BreadcrumbSeparator className="hidden md:block" />}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <AnimatePresence mode="wait">
        {location.pathname.includes('/editor') && (
          <motion.div
            key="toolbar"
            initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -4, transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in } }}
            transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
            className="flex flex-1 justify-center"
          >
            <ResumeConfigToolbar />
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn('ml-auto flex shrink-0 items-center gap-2', isResumeEditor && '[&>div:first-child]:hidden')}>
        <GithubStars>
          <div className="p-1 bg-muted flex items-center gap-1 rounded">
            <GithubStarsNumber className="text-muted-foreground font-medium" />
            <GithubStarsParticles>
              <GithubStarsIcon
                icon={StarIcon}
                className="fill-neutral-300 stroke-neutral-300 dark:fill-neutral-700 dark:stroke-neutral-700"
                activeClassName="text-muted-foreground"
                size={18}
              />
            </GithubStarsParticles>
          </div>
        </GithubStars>
        <AnimatedThemeToggler />
      </div>
    </div>
  )
}
