import { X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { PresenceDiv } from '@/components/motion/presence-item'
import { Button } from '@/components/ui/button'
import { DURATION, EASE, staggerDelay } from '@/lib/motion'

export interface ComposerSkill {
  id: string
  displayName: string
}

interface SkillPickerProps {
  skills: ComposerSkill[]
  disabled?: boolean
  onRemove: (id: string) => void
  label?: string
}

/** 已选技能只保留轻量元数据；正文在运行时才按需读取。 */
export function SkillPicker({
  skills,
  disabled = false,
  onRemove,
  label = '技能',
}: SkillPickerProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <AnimatePresence initial={false}>
      {skills.length > 0 && (
        <PresenceDiv
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            y: shouldReduceMotion ? 0 : 8,
            transition: {
              duration: shouldReduceMotion ? 0 : DURATION.fast,
              ease: EASE.in,
              delay: 0,
            },
          }}
          transition={{
            duration: shouldReduceMotion ? 0 : DURATION.base,
            ease: EASE.out,
          }}
          className='flex flex-wrap gap-1.5 px-3 pt-2'
          aria-label={`本次已选${label}`}
          data-composer-tags
        >
          <span className='self-center text-xs text-zinc-500 dark:text-zinc-400'>
            {label}
          </span>
          <AnimatePresence initial={false}>
            {skills.map((skill, index) => (
              <PresenceDiv
                key={skill.id}
                initial={
                  shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }
                }
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: shouldReduceMotion ? 1 : 0.96,
                  transition: {
                    duration: shouldReduceMotion ? 0 : DURATION.fast,
                    ease: EASE.in,
                    delay: 0,
                  },
                }}
                transition={{
                  duration: shouldReduceMotion ? 0 : DURATION.fast,
                  delay: shouldReduceMotion ? 0 : staggerDelay(index),
                  ease: EASE.out,
                }}
                className='inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-medium text-primary'
              >
                <span className='truncate'>{skill.displayName}</span>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-xs'
                  aria-label={`移除${label} ${skill.displayName}`}
                  disabled={disabled}
                  onClick={(event) => {
                    const button = event.currentTarget

                    const siblings = Array.from(
                      button
                        .closest('[data-composer-tags]')
                        ?.querySelectorAll<HTMLButtonElement>(
                          'button:not(:disabled)',
                        ) ?? [],
                    ).filter((item) => !item.closest('[inert]'))

                    const index = siblings.indexOf(button)
                    const target = siblings[index + 1] ?? siblings[index - 1]

                    const input = button
                      .closest('[data-composer]')
                      ?.querySelector<HTMLTextAreaElement>('textarea')

                    if (target) target.focus()
                    else input?.focus({ preventScroll: true })

                    onRemove(skill.id)
                  }}
                  className='size-5 shrink-0 rounded-full text-primary/75 hover:bg-primary/15 hover:text-primary'
                >
                  <X className='size-3.5' />
                </Button>
              </PresenceDiv>
            ))}
          </AnimatePresence>
        </PresenceDiv>
      )}
    </AnimatePresence>
  )
}
