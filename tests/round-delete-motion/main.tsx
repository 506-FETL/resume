import { createRoot } from 'react-dom/client'
import { useRef, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { InterviewSubStages } from '@/pages/tracker/components/drawer/interview-sub-stages'
import type { InterviewSubStage } from '@/pages/tracker/types'
import '@/index.css'

const makeRounds = (count: number): InterviewSubStage[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `round-${i + 1}`,
    label: `第 ${i + 1} 轮面试`,
    status: i === count - 1 ? '进行中' : '已完成',
    start_date: '2026-10-29',
    notes: '',
    order: i,
  }))

function Harness() {
  const [rounds, setRounds] = useState(() => makeRounds(3))
  const [run, setRun] = useState(0)
  const [result, setResult] = useState('尚未删除')
  const sequence = useRef(10)

  const record = () => {
    const samples: {
      t: number
      x: number | null
      width: number
      scroll: number
      inert: number
    }[] = []

    const start = performance.now()

    const frame = () => {
      const add = [...document.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('添加下一轮'),
      )

      const viewport = document.querySelector('[aria-label="选择面试轮次"]')
        ?.parentElement?.parentElement

      samples.push({
        t: Math.round(performance.now() - start),
        x: add?.getBoundingClientRect().x ?? null,
        width: viewport?.scrollWidth ?? 0,
        scroll: viewport?.scrollLeft ?? 0,
        inert: document.querySelectorAll('[inert]').length,
      })

      if (performance.now() - start < 650) requestAnimationFrame(frame)
      else setResult(JSON.stringify(samples))
    }

    frame()
  }

  const reset = (count: number) => {
    setRounds(makeRounds(count))
    setRun((value) => value + 1)
    setResult('尚未删除')
  }

  return (
    <TooltipProvider>
      <main className='mx-auto max-w-4xl space-y-6 p-4'>
        <h1 className='text-lg font-semibold'>
          面试轮次动画验收（仅本页内存数据）
        </h1>
        <div className='flex flex-wrap gap-2'>
          <Button onClick={() => reset(3)}>重置三轮</Button>
          <Button onClick={() => reset(5)}>重置五轮</Button>
          <Button onClick={() => reset(1)}>重置一轮</Button>
          <Button
            onClick={() => {
              const removed = rounds.at(-1)

              if (!removed) return

              record()

              setRounds((items) =>
                items.filter((item) => item.id !== removed.id),
              )

              setTimeout(() => setRounds((items) => [...items, removed]), 70)
            }}
          >
            退出中恢复
          </Button>
        </div>
        <InterviewSubStages
          key={run}
          jobId='local-motion-fixture'
          subStages={rounds}
          canAdd
          saveStatus={<span>本地验收</span>}
          onFlush={() => {}}
          onAddSubStage={() => {
            const id = `round-${sequence.current++}`

            setRounds((items) => [
              ...items,
              {
                id,
                label: '新增面试',
                status: '进行中',
                start_date: null,
                notes: '',
                order: items.length,
              },
            ])

            return id
          }}
          onDeleteSubStage={(id) => {
            record()
            setRounds((items) => items.filter((item) => item.id !== id))
          }}
          onUpdateSubStage={(id, updates) =>
            setRounds((items) =>
              items.map((item) =>
                item.id === id ? { ...item, ...updates } : item,
              ),
            )
          }
        />
        <pre aria-label='动画采样' className='max-h-36 overflow-auto text-xs'>
          {result}
        </pre>
      </main>
    </TooltipProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Harness />)
