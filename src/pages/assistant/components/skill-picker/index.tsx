import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { DURATION, EASE, staggerDelay } from '@/lib/motion'

export interface ComposerSkill {
  id: string
  displayName: string
}

interface SkillPickerProps {
  skills: ComposerSkill[]
  disabled?: boolean
  onRemove: (id: string) => void
}

/** 已选技能只保留轻量元数据；正文在运行时才按需读取。 */
export function SkillPicker({ skills, disabled = false, onRemove }: SkillPickerProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <AnimatePresence initial={false}>
      {skills.length > 0 && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
          transition={{ duration: shouldReduceMotion ? 0 : DURATION.base, ease: EASE.out }}
          className="flex flex-wrap gap-1.5 px-3 pt-2"
          aria-label="本次已选技能"
        >
          <span className="self-center text-xs text-zinc-500 dark:text-zinc-400">技能</span>
          <AnimatePresence initial={false}>
            {skills.map((skill, index) => (
              <motion.span
                key={skill.id}
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : DURATION.fast,
                  delay: shouldReduceMotion ? 0 : staggerDelay(index),
                  ease: EASE.out,
                }}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-medium text-primary"
              >
                <span className="truncate">{skill.displayName}</span>
                <button
                  type="button"
                  aria-label={`移除技能 ${skill.displayName}`}
                  disabled={disabled}
                  onClick={() => onRemove(skill.id)}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-primary/75 transition-colors hover:bg-primary/15 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
