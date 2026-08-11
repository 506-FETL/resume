import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorFallback from './components/ErrorBoundary'
import '@fontsource-variable/noto-sans-sc/wght.css'
import '@fontsource-variable/noto-serif-sc/wght.css'
import '@fontsource/lxgw-wenkai/500.css'
import '@fontsource/lxgw-wenkai/700.css'
import './index.css'

const app = createRoot(document.getElementById('root')!)

app.render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
