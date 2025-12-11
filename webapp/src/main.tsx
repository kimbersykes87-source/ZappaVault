import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './context/ToastContext.tsx'
import { ToastContainer } from './components/ToastContainer.tsx'

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
        <ToastContainer />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
