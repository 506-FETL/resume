import type { SkillContent } from '@/lib/resume-template/content/types'
import OutlinedFields from '../../outlined-fields/v1'

export default function SkillBadges({ items }: { items: SkillContent[] }) {
  return <OutlinedFields items={items.map(item => item.field)} />
}
