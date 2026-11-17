import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { WORKSPACE_PATH } from '@/lib/workspace-path'
import { formatDate } from '@/utils/date'
import type { ChangelogFrontmatter } from '../../types'
import '@fontsource/racing-sans-one/latin-400.css'
import '../milestone-entry/milestone.css'

export function ReleaseCover({ release }: { release: ChangelogFrontmatter }) {
  return (
    <header className='release-cover'>
      <div className='release-masthead'>
        <h2 id={`release-${release.version}`}>
          <span className='release-brand'>GResume</span>
          <span className='sr-only'> {release.version} </span>
          <span className='release-announcement'>正式发布</span>
        </h2>
        <time dateTime={release.date}>{formatDate(release.date)}</time>
      </div>
      <div className='release-cover-body'>
        <div className='release-edition'>
          <span className='release-version' aria-hidden='true'>
            {release.version}
          </span>
        </div>
        <div className='release-introduction'>
          <p className='release-headline'>{release.title}</p>
          <p className='release-description'>{release.description}</p>
          <Button asChild size='lg' className='release-start'>
            <Link to={WORKSPACE_PATH}>
              进入工作台
              <ArrowRight aria-hidden='true' />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
