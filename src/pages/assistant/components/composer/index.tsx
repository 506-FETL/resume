import { Composer as GaiaComposer } from '@/components/ui/composer'
import { COMPOSER_PLACEHOLDER } from '../../const'
import { useChatStream } from '../../hooks/use-chat-stream'
import useAssistantStore from '../../store'

export default function Composer() {
  const { streaming, composerDraft: draft, initializing, loadingMessages } = useAssistantStore()
  const { sendMessage } = useChatStream()
  const disabled = streaming || initializing || loadingMessages

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-6 lg:px-8">
      <GaiaComposer
        value={draft}
        placeholder={COMPOSER_PLACEHOLDER}
        disabled={disabled}
        showToolsButton={false}
        onChange={value => useAssistantStore.getState().setComposerDraft(value)}
        onSubmit={(message) => {
          const text = message.trim()
          if (text && !disabled) {
            useAssistantStore.getState().setComposerDraft('')
            sendMessage(text)
          }
        }}
      />
    </div>
  )
}
