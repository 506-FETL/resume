import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import {
  demoRoles,
  storyExamples,
  type DemoRole,
} from '../feature-guide/story-example'
import './version-demo.css'

interface VersionDemoProps {
  role: DemoRole
  onRoleChange: (role: DemoRole) => void
}

export default function VersionDemo({ role, onRoleChange }: VersionDemoProps) {
  const reduced = useReducedMotion()

  return (
    <div
      className='version-desk'
      role='region'
      aria-label='柳如烟的示例简历'
      data-reduced-motion={reduced}
    >
      <div className='cover-artboard'>
        <svg
          className='cover-origin'
          viewBox='0 0 600 450'
          aria-hidden='true'
        />

        <Tabs
          className='cover-versions'
          value={role}
          onValueChange={(value) =>
            onRoleChange(value === 'frontend' ? 'frontend' : 'design')
          }
        >
          <TabsList aria-label='示例简历的岗位版本' className='cover-dividers'>
            {demoRoles.map((version) => (
              <TabsTrigger key={version} value={version}>
                {storyExamples[version].tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className='story-sr'>
            {demoRoles.map((version) => (
              <TabsContent key={version} value={version} tabIndex={-1}>
                {storyExamples[version].job}，项目经历为
                {storyExamples[version].project.name}。
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  )
}
