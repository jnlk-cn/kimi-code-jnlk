import './platform/bootstrap';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { RendererErrorBoundary } from './error-boundary';
import './styles.css';
import './components/workspace-sidebar.css';
import './components/workspace-rail.css';
import './components/motion.css';
import './components/markdown-message.css';
import './components/codex-interaction.css';
import '@xterm/xterm/css/xterm.css';
import './terminal-xterm.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Missing #root');
const root = createRoot(rootElement);

function renderFatal(message: string): void {
  root.render(
    <div className="splash boot-fatal">
      <div className="splash-title">Ganymede Code</div>
      <p className="boot-fatal-message">{message}</p>
      <button className="primary-button" onClick={() => location.reload()} type="button">
        重新加载
      </button>
    </div>,
  );
}

function bootMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  return '界面加载失败，请重新加载页面。';
}

window.addEventListener('error', (event) => {
  if (rootElement.querySelector('.app-shell') !== null) return;
  event.preventDefault();
  renderFatal(event.error instanceof Error ? event.error.message : event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  if (rootElement.querySelector('.app-shell') !== null) return;
  event.preventDefault();
  renderFatal(bootMessage(event.reason));
});

if (window.ganymede === undefined) {
  renderFatal('Desktop API bridge is unavailable. Restart Ganymede Code or reload the page.');
} else {
  try {
    root.render(
      <StrictMode>
        <RendererErrorBoundary>
          <App />
        </RendererErrorBoundary>
      </StrictMode>,
    );
  } catch (error: unknown) {
    renderFatal(bootMessage(error));
  }
}
