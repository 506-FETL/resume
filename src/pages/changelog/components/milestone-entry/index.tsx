import type { MDXComponents } from 'mdx/types'
import type { ChangelogEntry } from '../../types'
import { motion } from 'motion/react'
import { useReleaseMotion } from '../../hooks/use-release-motion'
import { ReleaseCover } from '../release-cover'
import { ReleaseFeature, ReleaseFeatures } from '../release-feature'

const components: MDXComponents = { ReleaseFeature, ReleaseFeatures }

export function MilestoneEntry({ entry }: { entry: ChangelogEntry }) {
  const { frontmatter, Content } = entry
  const entrance = useReleaseMotion()

  return (
    <>
      <article
        className='release-story'
        aria-labelledby={`release-${frontmatter.version}`}
      >
        <ReleaseCover release={frontmatter} />

        <div className='release-body'>
          <Content components={components} />
        </div>

        <motion.footer className='release-closing' {...entrance}>
          <p>Thanks</p>
        </motion.footer>
      </article>
      <div className='mb-8 flex items-center gap-4'>
        <h2 className='shrink-0 text-sm font-medium text-muted-foreground'>
          previous
        </h2>
        <div className='h-px flex-1 bg-border' />
      </div>
    </>
  )
}
