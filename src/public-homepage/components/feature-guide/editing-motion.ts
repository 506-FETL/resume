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
  const lineStart = line.getPointAtLength(0)
  const roleWidth = example.responsibility.length * fieldMetrics.role

  gsap.set(art('role-tag'), {
    autoAlpha: 0,
    y: -22,
    rotation: 9,
    svgOrigin: '371 49',
  })

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
      art('agent-face'),
      art('confirm-save'),
      art('confirm-change'),
      art('evidence'),
      art('selection'),
    ].join(','),
    { autoAlpha: 0 },
  )

  gsap.set(art('selection'), { scaleX: 0, svgOrigin: '207 272' })
  gsap.set('[data-ledger-line]', { opacity: 0, x: -5 })
  gsap.set('[data-caret="description"]', { opacity: 0, x: -17, y: 8 })
  gsap.set('[data-caret="date"]', { opacity: 0, x: 15, y: -12 })
  gsap.set('[data-field-rule]', { opacity: 0 })

  gsap.set('[data-note-side="report"]', { autoAlpha: 0, y: 8 })
  gsap.set(art('saved-label'), { autoAlpha: 0 })

  timeline
    .addLabel('review', 1)
    .to(camera, { scale: portrait ? 1.32 : 1.095, y: -1, duration: 0.53 }, 0.8)
    .to(
      art('role-tag'),
      { autoAlpha: 1, y: 0, rotation: 0, duration: 0.28 },
      0.89,
    )
    .to(parsed, { autoAlpha: 1, x: 0, y: 0, rotation: 0, duration: 0.14 }, 0.95)
    .to(ledger, { autoAlpha: 1, x: 0, y: 0, rotation: 0, duration: 0.21 }, 1.15)
    .to(
      parsed,
      { autoAlpha: 0, x: 49, y: -17, rotation: 5, duration: 0.14 },
      1.17,
    )
    .to(art('evidence'), { autoAlpha: 1, duration: 0.08 }, 1.22)
    .to(
      pencil,
      {
        autoAlpha: 1,
        x: circleStart.x,
        y: circleStart.y,
        rotation: 0,
        duration: 0.14,
      },
      1.16,
    )

  traceWithPencil(timeline, pencil, circle, 1.3, 0.2)

  timeline.to(
    pencil,
    {
      motionPath: {
        path: [
          { x: lineStart.x + 54, y: lineStart.y - 44 },
          { x: lineStart.x, y: lineStart.y },
        ],
      },
      rotation: -3,
      duration: 0.07,
    },
    1.5,
  )

  traceWithPencil(timeline, pencil, line, 1.57, 0.15)

  timeline
    .to(
      pencil,
      {
        motionPath: {
          path: [
            { x: 307, y: 221 },
            { x: 251, y: 222 },
          ],
        },
        rotation: 1,
        duration: 0.07,
      },
      1.72,
    )
    .to(art('evidence'), { autoAlpha: 0, duration: 0.13 }, 1.8)
    .to(
      '[data-ink="role"]',
      { attr: { width: roleWidth }, duration: 0.12 },
      1.79,
    )
    .to(pencil, { x: 251 + roleWidth, duration: 0.12 }, 1.79)
    .to('[data-check="role"]', drawStroke(0.07), 1.91)
    .to(
      pencil,
      { autoAlpha: 0, x: 346, y: 186, rotation: 8, duration: 0.07 },
      1.91,
    )
    .to('[data-note-side="job"]', { autoAlpha: 0, y: -6, duration: 0.14 }, 1.23)
    .to(
      '[data-note-side="report"]',
      { autoAlpha: 1, y: 0, duration: 0.18 },
      1.34,
    )
    .addLabel('assistant', 2)
    .to(art('report-face'), { autoAlpha: 0, y: -6, duration: 0.13 }, 1.98)
    .to(ledger, { y: 5, rotation: 2, duration: 0.13 }, 1.98)
    .to(ledger, { y: 0, rotation: 0, duration: 0.17 }, 2.11)
    .to(art('agent-face'), { autoAlpha: 1, duration: 0.15 }, 2.06)
    .to('[data-ledger-line="read"]', { opacity: 1, x: 0, duration: 0.12 }, 2.08)
    .to('[data-check="read"]', drawStroke(0.1), 2.18)
    .to('[data-ledger-line="save"]', { opacity: 1, x: 0, duration: 0.12 }, 2.19)
    .to(art('confirm-save'), { autoAlpha: 1, duration: 0.1 }, 2.28)
    .to('[data-check="save"]', drawStroke(0.1), 2.37)
    .to(change, { autoAlpha: 1, x: 0, y: 0, rotation: 0, duration: 0.16 }, 2.43)
    .to(
      '[data-ledger-line="write"]',
      { opacity: 1, x: 0, duration: 0.14 },
      2.49,
    )
    .to(art('confirm-change'), { autoAlpha: 1, duration: 0.1 }, 2.65)
    .to('[data-confirm-ink]', drawStroke(0.08), 2.7)
    .to(art('saving-label'), { autoAlpha: 0, duration: 0.09 }, 2.37)
    .to(art('saved-label'), { autoAlpha: 1, duration: 0.1 }, 2.43)
    .to(
      change,
      { autoAlpha: 0, y: -16, x: 28, rotation: 3, duration: 0.15 },
      2.77,
    )
    .to(art('original'), { opacity: 0, duration: 0.1 }, 2.78)
    .to(
      '[data-ink="first"]',
      {
        attr: { width: example.lines[0].length * fieldMetrics.description },
        duration: 0.12,
      },
      2.8,
    )
    .to(
      '[data-ink="second"]',
      {
        attr: { width: example.lines[1].length * fieldMetrics.description },
        duration: 0.13,
      },
      2.812,
    )
    .to('[data-check="write"]', drawStroke(0.09), 2.855)
    .to(
      ledger,
      { autoAlpha: 0, y: 30, x: -26, rotation: -5, duration: 0.23 },
      2.98,
    )
    .addLabel('collaboration', 3)
    .to(camera, { scale: portrait ? 1.46 : 1.23, y: 13, duration: 0.38 }, 2.95)
    .to(
      '[data-caret="description"],[data-caret="date"]',
      { opacity: 1, x: 0, y: 0, duration: 0.2 },
      3.05,
    )
    .to(art('selection'), { autoAlpha: 1, scaleX: 1, duration: 0.16 }, 3.09)
    .to('[data-field="second"]', { opacity: 0, duration: 0.14 }, 3.23)
    .to(art('selection'), { autoAlpha: 0, duration: 0.14 }, 3.23)
    .to('[data-field-rule]', { opacity: 0.42, duration: 0.18 }, 3.19)

  // 两支插入符和各自的墨迹共用进度。反滚也会退回到同一个字。
  for (const [field, value] of [
    ['description', example.jointLine],
    ['date', example.project.period],
  ] as const) {
    const width = Array.from(value).length * fieldMetrics[field]
    const stroke = { duration: 0.5, ease: 'sine.inOut' }

    timeline
      .to(`[data-ink="${field}"]`, { attr: { width }, ...stroke }, 3.32)
      .to(`[data-caret-track="${field}"]`, { x: width, ...stroke }, 3.32)
  }

  timeline
    .to(
      '[data-caret="description"]',
      { opacity: 0, y: 8, duration: 0.18 },
      3.93,
    )
    .to('[data-caret="date"]', { opacity: 0, y: -7, duration: 0.18 }, 3.93)
    .to('[data-field-rule]', { opacity: 0, duration: 0.18 }, 3.93)
    .to(
      '[data-field="date"] [data-field-value], [data-field="description"] [data-field-value]',
      { fill: '#292e35', duration: 0.24 },
      3.94,
    )
    .to(
      camera,
      {
        scale: portrait ? 1.19 : 1.11,
        x: portrait ? 12 : 0,
        y: 5,
        duration: 0.38,
      },
      3.93,
    )
}
