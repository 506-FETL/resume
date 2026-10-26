import type { CSSProperties, ReactNode } from 'react'
import type { FormFeedback } from '@/components/ui/form'
import type { ORDERType } from '@/lib/schema'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReducedMotion } from 'motion/react'
import { FormFeedbackProvider } from '@/components/ui/form'
import { DURATION, EASE } from '@/lib/motion'
import useResumeStore from '@/store/resume/form'
import { useResumeCheckStore } from '../../store/checks'
import { checkFormPath } from '../../utils/check-focus'
import { CHECK_LEVELS } from '../../utils/check-presentation'
import './style.css'

const PRIORITY = { error: 0, warning: 1, suggestion: 2 }

export default function CheckFields({
  section,
  children,
}: {
  section: ORDERType
  children: ReactNode
}) {
  const issues = useResumeCheckStore((state) => state.issues)
  const reduced = useReducedMotion()

  const targets = useMemo(
    () =>
      issues.flatMap((issue) => {
        if (issue.resolved || issue.source === 'layout') return []

        // 缺失标题的其他目标只参与签名校验。
        const candidates = issue.id.startsWith('missing:title:')
          ? issue.targets.slice(0, 1)
          : issue.targets

        return candidates
          .filter((target) => target.section === section)
          .map((target) => ({ target, issue }))
      }),
    [issues, section],
  )

  // 只有条目路径变化（新增、删除、重排）才更新上下文；普通打字不广播到所有字段。
  const paths = useResumeStore(
    useShallow((state) =>
      targets.map(({ target }) => checkFormPath(target, state[section])),
    ),
  )

  const feedback = useMemo(() => {
    const fields: Record<string, FormFeedback> = {}

    targets.forEach(({ issue }, index) => {
      const path = paths[index]

      if (!path) return

      const names = [path, path.replace(/\.[01]$/, '')]

      for (const name of names) {
        if (
          fields[name] &&
          PRIORITY[fields[name].severity] <= PRIORITY[issue.severity]
        )
          continue

        fields[name] = {
          severity: issue.severity,
          message: `${CHECK_LEVELS[issue.severity].label}：${issue.title}`,
        }
      }
    })

    return fields
  }, [targets, paths])

  return (
    <FormFeedbackProvider value={feedback}>
      <div
        data-editor-section={section}
        className='resume-check-fields'
        style={
          {
            '--field-check-duration': `${reduced ? 0 : DURATION.fast}s`,
            '--field-check-ease': `cubic-bezier(${EASE.out.join(',')})`,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </FormFeedbackProvider>
  )
}
