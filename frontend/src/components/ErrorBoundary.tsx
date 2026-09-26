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
          <div className="mx-auto max-w-md py-16 text-center">
            <div className="glass-card rounded-xl p-6">
              <p className="text-sm font-medium text-red-400">Something went wrong</p>
              <pre className="mt-3 overflow-x-auto text-left font-mono text-xs text-zinc-500">
                {this.state.error.message}
              </pre>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
