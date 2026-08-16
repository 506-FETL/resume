import { StarIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'
import { Fragment } from 'react/jsx-runtime'
import { GithubStars, GithubStarsIcon, GithubStarsNumber, GithubStarsParticles } from '@/components/animate-ui/primitives/animate/github-stars'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs'
import ResumeConfigToolbar from '@/pages/resume/editor/components/toolbar'
import { AnimatedThemeToggler } from '../ui/animated-theme-toggler'

export function SiteHeader() {
  const crumbs = useBreadcrumbs()
  const location = useLocation()

  return (
    <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 z-1000 relative">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, idx) => (
            <Fragment key={crumb.label}>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
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
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex flex-1 justify-center"
          >
            <ResumeConfigToolbar />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="ml-auto flex items-center gap-2">
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
