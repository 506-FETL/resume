import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { PresenceDiv } from '@/components/motion/presence-item'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { useLibrarySearch } from '../../hooks/use-library-search'

export default function LibrarySearch() {
  const inputRef = useRef<HTMLInputElement>(null)

  const { input, changeInput, setComposing, finishComposition } =
    useLibrarySearch()

  const reduceMotion = useReducedMotion()

  return (
    <InputGroup className='w-full sm:max-w-80'>
      <InputGroupAddon>
        <Search aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        id='resume-library-search'
        type='search'
        aria-label='按名称或描述搜索简历'
        placeholder='搜索名称或描述'
        value={input}
        onChange={(event) => changeInput(event.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(event) =>
          finishComposition(event.currentTarget.value)
        }
        className='[&::-webkit-search-cancel-button]:appearance-none'
      />
      <InputGroupAddon align='inline-end' className='h-9 w-9 p-0'>
        <AnimatePresence initial={false}>
          {input && (
            <PresenceDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduceMotion ? 0 : DURATION.fast,
                ease: EASE.out,
              }}
            >
              <InputGroupButton
                size='icon-sm'
                className='size-9'
                aria-label='清空搜索'
                onClick={() => {
                  inputRef.current?.focus({ preventScroll: true })
                  changeInput('')
                }}
              >
                <X aria-hidden />
              </InputGroupButton>
            </PresenceDiv>
          )}
        </AnimatePresence>
      </InputGroupAddon>
    </InputGroup>
  )
}
