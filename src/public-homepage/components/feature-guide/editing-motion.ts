import gsap from 'gsap'
import { drawStroke, traceWithPencil } from '../ink-motion'
import type { DemoRole } from './story-example'
import { fieldMetrics, storyExamples } from './story-example'

export const art = (layer: string) => `[data-art="${layer}"]`

export function addEditingMotion(
  timeline: gsap.core.Timeline,
  track: HTMLElement,
  role: DemoRole,
  portrait: boolean,
) {
  const example = storyExamples[role]
  const pencil = art('pencil')
  const ledger = art('ledger')
  const parsed = art('parsing-proof')
  const change = art('change-proof')
  const camera = '[data-camera="paper"]'

  const circle = track.querySelector<SVGPathElement>(
    '[data-proof-ink="circle"]',
  )!

  const line = track.querySelector<SVGPathElement>(
    '[data-proof-ink="underline"]',
  )!

  const circleStart = circle.getPointAtLength(0)
  const circleEnd = circle.getPointAtLength(circle.getTotalLength())
  const lineStart = line.getPointAtLength(0)
  const lineEnd = line.getPointAtLength(line.getTotalLength())
  const roleWidth = example.responsibility.length * fieldMetrics.role

  gsap.set(pencil, {
    autoAlpha: 0,
    x: circleStart.x + 26,
    y: circleStart.y - 31,
    rotation: -8,
    scale: 0.55,
    svgOrigin: '0 0',
  })

  gsap.set(parsed, {
    autoAlpha: 0,
    x: 39,
    y: -24,
    rotation: 5,
    svgOrigin: '310 206',
  })

  gsap.set(change, {
    autoAlpha: 0,
    x: -32,
    y: 15,
    rotation: -5,
    svgOrigin: '319 239',
  })

  gsap.set(ledger, {
    autoAlpha: 0,
    x: -28,
    y: 39,
    rotation: 7,
    svgOrigin: '308 352',
  })

  gsap.set(
    [
      art('confirm-save'),
      art('confirm-change'),
      art('evidence'),
      art('selection'),
    ].join(','),
    { autoAlpha: 0 },
  )

  gsap.set(art('selection'), { scaleX: 0, svgOrigin: '207 272' })
  gsap.set('[data-caret="description"]', { opacity: 0, x: -17, y: 8 })
  gsap.set('[data-caret="date"]', { opacity: 0, x: 15, y: -12 })
  gsap.set('[data-field-rule]', { opacity: 0 })
  gsap.set('[data-note-side="report"]', { autoAlpha: 0, y: 8 })
  gsap.set(art('saved-label'), { autoAlpha: 0 })

  timeline
    .addLabel('review', 1)
    .addLabel('read-parsing', 1.2)
    .addLabel('mark-role', 1.5)
    .addLabel('mark-description', 1.72)
    .addLabel('fill-role', 1.88)
    .to(camera, { scale: portrait ? 1.32 : 1.095, y: -1, duration: 0.4 }, 0.9)
    .to(parsed, { autoAlpha: 1, x: 0, y: 0, rotation: 0, duration: 0.12 }, 1.06)
    .to(
      parsed,
      { autoAlpha: 0, x: 49, y: -17, rotation: 5, duration: 0.09 },
      1.31,
    )
    .to('[data-note-side="job"]', { autoAlpha: 0, y: -6, duration: 0.08 }, 1.3)
    .to(
      '[data-note-side="report"]',
      { autoAlpha: 1, y: 0, duration: 0.11 },
      1.38,
    )
    .to(ledger, { autoAlpha: 1, x: 0, y: 0, rotation: 0, duration: 0.11 }, 1.39)
    .to(art('evidence'), { autoAlpha: 1, duration: 0.06 }, 1.4)
    .to(
      pencil,
      {
        autoAlpha: 1,
        x: circleStart.x,
        y: circleStart.y,
        rotation: 0,
        duration: 0.1,
      },
      1.4,
    )

  traceWithPencil(timeline, pencil, circle, 1.5, 0.13)

  timeline.to(
    pencil,
    {
      motionPath: {
        fromCurrent: false,
        path: [
          { x: circleEnd.x, y: circleEnd.y },
          { x: 269, y: 199 },
          { x: lineStart.x, y: lineStart.y },
        ],
      },
      rotation: -3,
      duration: 0.09,
    },
    1.63,
  )

  traceWithPencil(timeline, pencil, line, 1.72, 0.08)

  timeline
    .to(
      pencil,
      {
        motionPath: {
          fromCurrent: false,
          path: [
            { x: lineEnd.x, y: lineEnd.y },
            { x: 302, y: 203 },
            { x: 251, y: 222 },
          ],
        },
        rotation: 1,
        duration: 0.08,
      },
      1.8,
    )
    .to(art('evidence'), { autoAlpha: 0, duration: 0.08 }, 1.88)
    .to(
      '[data-ink="role"]',
      { attr: { width: roleWidth }, duration: 0.08, ease: 'none' },
      'fill-role',
    )
    .to(
      pencil,
      { x: 251 + roleWidth, duration: 0.08, ease: 'none' },
      'fill-role',
    )
    .to('[data-check="role"]', drawStroke(0.035), 1.96)
    .to(
      pencil,
      { autoAlpha: 0, x: 346, y: 186, rotation: 8, duration: 0.07 },
      1.96,
    )
    .addLabel('assistant', 2)
    .addLabel('read-diff', 2.48)
    .addLabel('confirm-edit', 2.54)
    .addLabel('write-first-line', 2.64)
    .addLabel('write-second-line', 2.72)
    .addLabel('edit-complete', 2.8)
    .addLabel('checklist-complete', 2.87)
    .to(
      '[data-check-row="pending"] text',
      { fill: '#264f9b', duration: 0.12 },
      2.08,
    )
    .to(art('confirm-save'), { autoAlpha: 1, duration: 0.08 }, 2.08)
    .to('[data-save-confirm-ink]', drawStroke(0.05), 2.23)
    .to(art('saving-label'), { autoAlpha: 0, duration: 0.04 }, 2.28)
    .to(art('saved-label'), { autoAlpha: 1, duration: 0.04 }, 2.32)
    .to(change, { autoAlpha: 1, x: 0, y: 0, rotation: 0, duration: 0.1 }, 2.36)
    .to(art('confirm-change'), { autoAlpha: 1, duration: 0.07 }, 2.47)
    .to('[data-confirm-ink]', drawStroke(0.05), 'confirm-edit')
    .to(
      change,
      { autoAlpha: 0, y: -16, x: 28, rotation: 3, duration: 0.05 },
      2.59,
    )
    .to(art('original'), { opacity: 0, duration: 0.05 }, 2.59)
    .to(
      '[data-ink="first"]',
      {
        attr: { width: example.lines[0].length * fieldMetrics.description },
        duration: 0.08,
        ease: 'none',
      },
      'write-first-line',
    )
    .to(
      '[data-ink="second"]',
      {
        attr: { width: example.lines[1].length * fieldMetrics.description },
        duration: 0.08,
        ease: 'none',
      },
      'write-second-line',
    )
    .to('[data-check="pending"]', drawStroke(0.07), 'edit-complete')
    .to(
      '[data-check-row="pending"] text',
      { fill: '#32433e', duration: 0.08 },
      'checklist-complete',
    )
    .to(
      ledger,
      { autoAlpha: 0, y: 30, x: -26, rotation: -5, duration: 0.16 },
      3.12,
    )
    .addLabel('collaboration', 3)
    .addLabel('coedit-writing', 3.54)
    .to(camera, { scale: portrait ? 1.46 : 1.23, y: 13, duration: 0.3 }, 3.08)
    .to(
      '[data-caret="description"],[data-caret="date"]',
      { opacity: 1, x: 0, y: 0, duration: 0.13 },
      3.25,
    )
    .to(art('selection'), { autoAlpha: 1, scaleX: 1, duration: 0.12 }, 3.34)
    .to('[data-field="second"]', { opacity: 0, duration: 0.08 }, 3.46)
    .to(art('selection'), { autoAlpha: 0, duration: 0.08 }, 3.46)
    .to('[data-field-rule]', { opacity: 0.42, duration: 0.12 }, 3.4)

  // 两支插入符和各自的墨迹共用进度。反滚也会退回到同一个字。
  for (const [field, value] of [
    ['description', example.jointLine],
    ['date', example.project.period],
  ] as const) {
    const width = Array.from(value).length * fieldMetrics[field]
    const stroke = { duration: 0.34, ease: 'none' }

    timeline
      .to(
        `[data-ink="${field}"]`,
        { attr: { width }, ...stroke },
        'coedit-writing',
      )
      .to(
        `[data-caret-track="${field}"]`,
        { x: width, ...stroke },
        'coedit-writing',
      )
  }

  timeline
    .to(
      '[data-caret="description"]',
      { opacity: 0, y: 8, duration: 0.14 },
      3.94,
    )
    .to('[data-caret="date"]', { opacity: 0, y: -7, duration: 0.14 }, 3.94)
    .to('[data-field-rule]', { opacity: 0, duration: 0.14 }, 3.94)
    .to(
      '[data-field="date"] [data-field-value], [data-field="description"] [data-field-value]',
      { fill: '#292e35', duration: 0.18 },
      3.94,
    )
    .to(
      camera,
      {
        scale: portrait ? 1.19 : 1.11,
        x: portrait ? 12 : 0,
        y: 5,
        duration: 0.3,
      },
      3.96,
    )
}
