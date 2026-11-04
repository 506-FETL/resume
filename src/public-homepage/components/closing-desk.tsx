import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION } from '@/lib/motion'
import { HandPencil } from './cover-marks'
import { InkPath } from './feature-guide/ink-path'
import { storyExamples, type DemoRole } from './feature-guide/story-example'
import { traceWithPencil } from './ink-motion'

gsap.registerPlugin(useGSAP, ScrollTrigger)

function FiledResume({ role }: { role: DemoRole }) {
  return (
    <g transform='rotate(-9 130 200)' stroke='#373433' strokeWidth='2.4'>
      <path
        d='m27 141 5-28q1-5 7-5l43-1 8-12 52-1 8 10 90-2q8 0 8 6l-3 137-212 8Z'
        fill='#dea545'
      />
      <path
        d='m37 117 46-1 9-12 43-1m20 8 81-2'
        stroke='#8f652a'
        strokeWidth='1.4'
        fill='none'
      />
      <g data-end-filed=''>
        <path d='m43 119 173-5 13 14 2 101-185 6Z' fill='#d6e1f1' />
        <path d='m48 114 163-5 14 12 1 105-177 4Z' fill='#fffaf0' />
        <text x='65' y='145' stroke='none' fill='#293342' fontSize='25'>
          柳如烟
        </text>
        <text x='65' y='166' stroke='none' fill='#4e5f78' fontSize='16'>
          {storyExamples[role].version}
        </text>
      </g>
      <path d='m19 177 66-2 16 9 148-4-12 81-195 6Z' fill='#a57934' />
      <path d='m18 172 67-2 15 9 148-4-12 82-196 6Z' fill='#efb146' />
      <path
        d='m24 177 58-2 16 10 143-5m-198 77 183-5'
        fill='none'
        stroke='#ffe497'
        strokeWidth='2.5'
      />
      <path
        d='m47 250 9 9m-4-11 9 11m-3-8 6 8m144-8 21-1'
        fill='none'
        stroke='#a17532'
        strokeWidth='1.4'
      />
      <g transform='rotate(-4 99 217)' fill='none' stroke='#3c5390'>
        <path
          d='M63 215c-1-12 16-20 37-20s38 7 38 19-17 21-38 21-37-8-37-20Z'
          strokeWidth='2.8'
        />
        <path
          d='M68 216c-1-10 13-17 32-17s33 6 33 15-15 17-32 17'
          strokeWidth='.9'
        />
        <text
          x='101'
          y='222'
          textAnchor='middle'
          fill='#344e8f'
          stroke='none'
          fontSize='21'
        >
          已投
        </text>
      </g>
    </g>
  )
}

export default function ClosingDesk({ role }: { role: DemoRole }) {
  const artRef = useRef<SVGSVGElement>(null)
  const reduced = useReducedMotion()

  useGSAP(
    () => {
      const scene = artRef.current!
      const pencil = scene.querySelector<SVGGElement>('[data-end-pencil]')!
      const line = scene.querySelector<SVGPathElement>('[data-end-ink]')!
      const start = line.getPointAtLength(0)
      const end = line.getPointAtLength(line.getTotalLength())
      const rest = { x: end.x + 10, y: end.y - 8, rotation: 8 }

      gsap.set(pencil, { svgOrigin: '0 0', ...rest })

      if (reduced) {
        gsap.set(line, { attr: { 'stroke-dashoffset': 0 } })

        return
      }

      const timeline = gsap.timeline({
        defaults: { ease: 'sine.inOut' },
        scrollTrigger: {
          trigger: scene.closest('footer'),
          start: 'top bottom',
          end: 'clamp(bottom bottom)',
          scrub: DURATION.base,
        },
      })

      gsap.set(pencil, { x: start.x + 34, y: start.y - 24, rotation: -6 })

      timeline
        .from(
          '[data-end-filed]',
          { y: -25, rotation: -3, svgOrigin: '58 201', duration: 0.36 },
          0.08,
        )
        .from(
          '[data-end-sheet]',
          { x: -43, y: 28, rotation: -8, svgOrigin: '310 178', duration: 0.47 },
          0.07,
        )
        .to(
          pencil,
          { x: start.x, y: start.y, rotation: 0, duration: 0.18 },
          0.33,
        )

      traceWithPencil(timeline, pencil, line, 0.51, 0.34)
      timeline.to(pencil, { ...rest, duration: 0.15 }, 0.85)
    },
    { scope: artRef, dependencies: [reduced], revertOnUpdate: true },
  )

  return (
    <svg
      ref={artRef}
      className='end-paper'
      viewBox='0 0 500 315'
      aria-hidden='true'
      focusable='false'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <FiledResume role={role} />
      <g data-end-sheet=''>
        <g transform='rotate(5 315 162)'>
          <path
            d='m201 35 186-3 21 21 2 236-206 4Z'
            fill='#ba904a'
            opacity='.52'
          />
          <path
            d='m193 34 187-5 24 21 1 231-206 6Z'
            fill='#dae5f1'
            stroke='#364258'
            strokeWidth='2'
          />
          <path
            d='M195 25q82 2 181-1l24 23 1 227q-104 4-211 1Z'
            fill='#fffdf3'
            stroke='#263344'
            strokeWidth='2.7'
          />
          <path
            d='m376 24-.5 24 24-1Z'
            fill='#f0dab2'
            stroke='#263344'
            strokeWidth='2'
          />
          <path
            d='m380 42 3-5m2 7 3-4'
            fill='none'
            stroke='#877757'
            strokeWidth='1.2'
          />
          <text x='217' y='82' fontSize='31' fontWeight='700' fill='#233657'>
            个人简历
          </text>
          <path
            d='m215 96 164-2m-164 6 116-1.5'
            fill='none'
            stroke='#5272ad'
            strokeWidth='1.5'
          />
          <text x='216' y='144' fontSize='20' fill='#3d4e69'>
            姓名
          </text>
          <InkPath
            data-end-ink=''
            d='M268 149q25-2 51-1t57-2'
            fill='none'
            stroke='#3357a6'
            strokeWidth='2.4'
          />
          <text x='217' y='195' fontSize='19' fill='#52627a'>
            项目经历
          </text>
          <path
            d='m220 213 136-1.5m-137 14 106-1m-107 14 125-1'
            fill='none'
            stroke='#adb5be'
            strokeWidth='1.55'
          />
          <path
            d='m212 264 14-1m144-1 12-1'
            fill='none'
            stroke='#b9bdba'
            strokeWidth='1.2'
          />
          <g data-end-pencil=''>
            <g transform='scale(.77)'>
              <HandPencil />
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}
