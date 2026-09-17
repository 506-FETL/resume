import type { AiSkillActivity } from '@/lib/ai/types'
import { BookOpen, CircleAlert, Loader2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { getSkillDefinition } from '@/lib/ai/skills/catalog'
import { DURATION, EASE } from '@/lib/motion'

export default function SkillActivity({ activity }: { activity: AiSkillActivity }) {
  const reduced = useReducedMotion()
  const skill = getSkillDefinition(activity.skillId)
  const pending = activity.state === 'loading'
  const failed = activity.state === 'error'
  const label = pending ? '正在加载' : failed ? '加载失败' : '本次使用'

  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : DURATION.base, ease: EASE.out }}
      className="my-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm">
        {pending
          ? <Loader2 className={`size-4 shrink-0 ${reduced ? '' : 'animate-spin'}`} />
          : failed
            ? <CircleAlert className="size-4 shrink-0 text-destructive" />
            : <BookOpen className="size-4 shrink-0 text-primary" />}
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{activity.displayName}</span>
      </div>
      {failed && <p className="mt-1 text-xs text-destructive">{activity.error}</p>}
      {skill && (
        <a href={skill.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-muted-foreground underline-offset-4 hover:underline">
          {skill.sourceLabel}
          {' · v'}
          {activity.version}
        </a>
      )}
    </motion.div>
  )
}
