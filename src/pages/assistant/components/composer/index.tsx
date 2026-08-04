import { Composer as GaiaComposer } from '@/components/ui/composer'
import { COMPOSER_PLACEHOLDER } from '../../const'
import { useChatStream } from '../../hooks/use-chat-stream'
import useAssistantStore from '../../store'

export default function Composer() {
  const streaming = useAssistantStore(s => s.streaming)
  const draft = useAssistantStore(s => s.composerDraft)
  const { sendMessage } = useChatStream()

  return (
    <div className="mx-auto w-full max-w-4xl px-6 lg:px-8">
      <GaiaComposer
        value={draft}
        placeholder={COMPOSER_PLACEHOLDER}
        disabled={streaming}
        showToolsButton={false}
        onChange={value => useAssistantStore.getState().setComposerDraft(value)}
        onSubmit={(message) => {
          const text = message.trim()
          if (text && !streaming) {
            useAssistantStore.getState().setComposerDraft('')
            sendMessage(text)
          }
        }}
      />
    </div>
  )
}
