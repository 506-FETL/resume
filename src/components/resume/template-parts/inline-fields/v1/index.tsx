import type { ContentField } from '@/lib/resume-template/content/types'
import OutlinedFields from '../../outlined-fields/v1'

export default function InlineFields({ items }: { items: ContentField[] }) {
  return <OutlinedFields items={items} keepEmpty />
}
