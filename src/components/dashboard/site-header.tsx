import { StarIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { Link, useLocation } from 'react-router-dom'
import { Fragment } from 'react/jsx-runtime'
import {
  GithubStars,
  GithubStarsIcon,
  GithubStarsNumber,
} from '@/components/animate-ui/primitives/animate/github-stars'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
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
    <div
      className={cn(
        'relative w-full min-w-0 items-center gap-1 px-2 sm:px-4 lg:gap-2',
        isResumeEditor
          ? 'grid grid-cols-[2rem_minmax(0,1fr)_2rem] gap-0 px-0 sm:gap-1 sm:px-4'
          : 'flex',
      )}
    >
      <SidebarTrigger
        className={cn('shrink-0', !isResumeEditor && '-ml-1')}
        aria-label='切换导航栏'
      />
      {!isResumeEditor && (
        <Separator
          orientation='vertical'
          className='mx-2 data-[orientation=vertical]:h-4'
        />
      )}
      {!isResumeEditor && (
        <Breadcrumb className='min-w-0'>
          <BreadcrumbList className='flex-nowrap'>
            {crumbs.map((crumb, idx) => (
              <Fragment key={crumb.href}>
                <BreadcrumbItem
                  className={cn(
                    'min-w-0',
                    idx < crumbs.length - 1 && 'hidden md:block',
                  )}
                >
                  {idx === crumbs.length - 1 ? (
                    <BreadcrumbPage className='truncate'>
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.href} className='whitespace-nowrap'>
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {idx < crumbs.length - 1 && (
                  <BreadcrumbSeparator className='hidden md:block' />
                )}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <AnimatePresence mode='wait'>
        {location.pathname.includes('/editor') && (
          <motion.div
            key='toolbar'
            initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: reduceMotion ? 0 : -4,
              transition: {
                duration: reduceMotion ? 0 : DURATION.fast,
                ease: EASE.in,
              },
            }}
            transition={{
              duration: reduceMotion ? 0 : DURATION.base,
              ease: EASE.out,
            }}
            className='@container/editor-toolbar flex min-w-0 flex-1 justify-center'
          >
            <ResumeConfigToolbar />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          'ml-auto flex shrink-0 items-center gap-2',
          isResumeEditor && '[&>div:first-child]:hidden',
        )}
      >
        <GithubStars>
          <Button
            asChild
            variant='ghost'
            size='sm'
            className='gap-1.5 px-2 text-xs text-muted-foreground'
          >
            <a
              href='https://github.com/506-fetl/resume'
              target='_blank'
              rel='noreferrer'
              aria-label='在 GitHub 查看 GResume 仓库'
            >
              <GithubStarsIcon
                icon={StarIcon}
                className='size-3.5'
                color='var(--color-amber-500)'
              />
              <GithubStarsNumber className='font-medium tabular-nums' />
            </a>
          </Button>
        </GithubStars>
        <AnimatedThemeToggler />
      </div>
    </div>
  )
}
