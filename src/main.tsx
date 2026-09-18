import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Image data is deliberately never logged or sent to a service. */
  }
  render() {
    if (this.state.failed)
      return (
        <main style={{ fontFamily: 'system-ui', maxWidth: 480, margin: '15vh auto', padding: 24 }}>
          <h1>Let’s give that another try.</h1>
          <p>
            The editor couldn’t continue. Reload to start fresh; your original files are safe on
            your device.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 20px', cursor: 'pointer' }}
          >
            Reload editor
          </button>
        </main>
      )
    return this.props.children
  }
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
