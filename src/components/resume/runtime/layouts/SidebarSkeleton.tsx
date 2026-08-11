import type { ReactNode } from 'react'
import { useRuntimeStyles } from '../renderers/utils'

interface SidebarSkeletonProps {
  header?: ReactNode
  main: ReactNode
  sidebar?: ReactNode
  sidebarPosition?: 'left' | 'right'
}

export default function SidebarSkeleton({
  header,
  main,
  sidebar,
  sidebarPosition = 'left',
}: SidebarSkeletonProps) {
  const { spacing } = useRuntimeStyles()

  const content = (
    <>
      <aside className="flex flex-col" style={{ gap: spacing.sectionMargin }}>
        {sidebar}
      </aside>
      <main className="flex min-w-0 flex-col" style={{ gap: spacing.sectionMargin }}>
        {main}
      </main>
    </>
  )

  return (
    <div className="flex flex-col" style={{ lineHeight: spacing.lineHeight }}>
      {header}
      <div
        className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)]"
        style={{
          rowGap: spacing.sectionMargin,
          columnGap: '1.5rem',
        }}
      >
        {sidebarPosition === 'right'
          ? (
              <>
                <main className="flex min-w-0 flex-col" style={{ gap: spacing.sectionMargin }}>
                  {main}
                </main>
                <aside className="flex flex-col" style={{ gap: spacing.sectionMargin }}>
                  {sidebar}
                </aside>
              </>
            )
          : content}
      </div>
    </div>
  )
}
