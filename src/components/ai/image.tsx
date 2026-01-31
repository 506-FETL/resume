import type { Experimental_GeneratedImage } from 'ai'
import { cn } from '@/lib/utils'

export type ImageProps = Experimental_GeneratedImage & {
  className?: string
  alt?: string
}

export function Image({ base64, uint8Array, mediaType, ...props }: ImageProps) {
  return (
    <img
      {...props}
      alt={props.alt}
      className={cn('h-auto max-w-full overflow-hidden rounded-md', props.className)}
      height={400}
      src={`data:${mediaType};base64,${base64}`}
      width={400}
    />
  )
}
