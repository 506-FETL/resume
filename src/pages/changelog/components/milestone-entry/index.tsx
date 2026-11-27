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
          <div className='release-body-heading'>
            <p>{frontmatter.version} 版功能</p>
          </div>
          <Content components={components} />
        </div>

        <motion.footer className='release-closing' {...entrance}>
          <p>谢谢你用 GResume 写简历。</p>
        </motion.footer>
      </article>
      <div className='mb-8 flex items-center gap-4'>
        <h2 className='shrink-0 text-sm font-medium text-muted-foreground'>
          此前的更新
        </h2>
        <div className='h-px flex-1 bg-border' />
      </div>
    </>
  )
}
