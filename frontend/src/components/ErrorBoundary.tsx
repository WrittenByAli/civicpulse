import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: '2rem', color: '#b91c1c' }}>
            <strong>Something went wrong.</strong>
            <pre style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
              {this.state.error.message}
            </pre>
          </div>
        )
      )
    }
    return this.props.children
  }
}
