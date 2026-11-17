import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useReleaseMotion } from '../../hooks/use-release-motion'

interface ReleaseFeatureProps {
  number: string
  category: string
  title: string
  href: string
  action: string
  children: ReactNode
}

export function ReleaseFeature({
  number,
  category,
  title,
  href,
  action,
  children,
}: ReleaseFeatureProps) {
  const entrance = useReleaseMotion((Number(number) - 1) % 2)

  return (
    <motion.section className='release-feature' {...entrance}>
      <div className='release-feature-label'>
        <span className='release-feature-number' aria-hidden='true'>
          {number}
        </span>
        <span>{category}</span>
      </div>
      <h3>{title}</h3>
      <div className='release-feature-copy'>{children}</div>
      <Button asChild variant='link' className='release-feature-link'>
        <Link to={href}>
          {action}
          <ArrowUpRight aria-hidden='true' />
        </Link>
      </Button>
    </motion.section>
  )
}

export function ReleaseFeatures({ children }: { children: ReactNode }) {
  return <div className='release-features'>{children}</div>
}
