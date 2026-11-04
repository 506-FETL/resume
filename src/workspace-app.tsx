import { ErrorBoundary } from 'react-error-boundary'
import { BrowserRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
import ErrorFallback from './components/ErrorBoundary'
import '@fontsource-variable/arimo/wght.css'
import '@fontsource/tinos/latin-400.css'
import '@fontsource/tinos/latin-700.css'
import '@fontsource/tinos/latin-400-italic.css'
import '@fontsource/tinos/latin-700-italic.css'
import '@fontsource-variable/noto-sans-sc/wght.css'
import '@fontsource-variable/noto-serif-sc/wght.css'
import './index.css'

export default function WorkspaceApp() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <BrowserRouter>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
