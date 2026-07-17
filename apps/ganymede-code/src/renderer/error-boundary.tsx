import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly error?: Error;
}

export class RendererErrorBoundary extends Component<Props, State> {
  override state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ganymede-renderer] render error', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error !== undefined) {
      return (
        <div className="splash boot-fatal">
          <div className="splash-title">Ganymede Code</div>
          <p className="boot-fatal-message">{error.message}</p>
          <button className="primary-button" onClick={() => location.reload()} type="button">
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
