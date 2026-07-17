import { randomUUID } from 'node:crypto';

import {
  BrowserWindow,
  WebContentsView,
  nativeTheme,
  shell,
  type Rectangle,
} from 'electron';

import {
  IPC,
  type AppSettings,
  type BrowserAction,
  type BrowserAnnotation,
  type BrowserTab,
} from '../shared/contracts';
import { hexToRgbTriplet, resolveAccentColor } from '../shared/theme-accent';
import { createScopedLogger } from './logging';

type Emit = (channel: string, payload: unknown) => void;

interface ManagedBrowser {
  readonly id: string;
  readonly sessionId?: string;
  readonly view: WebContentsView;
  bounds?: Rectangle;
  autoFit: boolean;
  fitTimer?: ReturnType<typeof setTimeout>;
}

type BrowserAnnotationSelection = Pick<
  BrowserAnnotation,
  'selector' | 'tag' | 'text' | 'html' | 'rect'
>;

const log = createScopedLogger('browser');

export class BrowserManager {
  private readonly browsers = new Map<string, ManagedBrowser>();

  constructor(
    private readonly window: BrowserWindow,
    private readonly emit: Emit,
    private readonly settings: () => AppSettings,
  ) {}

  async create(sessionId?: string, url = 'about:blank'): Promise<BrowserTab> {
    const id = randomUUID();
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: `persist:ganymede-browser`,
      },
    });
    const managed: ManagedBrowser = { id, sessionId, view, autoFit: true };
    this.browsers.set(id, managed);
    this.window.contentView.addChildView(view);
    view.setBounds(this.hiddenBounds());
    view.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
      if (nextUrl.startsWith('http://') || nextUrl.startsWith('https://')) {
        void shell.openExternal(nextUrl);
      }
      return { action: 'deny' };
    });
    view.webContents.session.setPermissionRequestHandler(
      (_webContents, permission, callback) => {
        callback(permission === 'clipboard-sanitized-write');
      },
    );
    const sendState = (): void => {
      this.emit(IPC.browserState, this.state(managed));
    };
    view.webContents.on('did-start-loading', sendState);
    view.webContents.on('did-stop-loading', () => {
      void this.fitToWidth(managed).catch(() => undefined).finally(sendState);
    });
    view.webContents.on('page-title-updated', sendState);
    view.webContents.on('did-navigate', sendState);
    view.webContents.on('did-navigate-in-page', sendState);
    view.webContents.on('devtools-opened', sendState);
    view.webContents.on('devtools-closed', sendState);
    await this.navigate(id, url);
    log.info('browser tab created', { id, sessionId, url });
    return this.state(managed);
  }

  async navigate(id: string, rawUrl: string): Promise<void> {
    const browser = this.require(id);
    const url = normalizeUrl(rawUrl);
    this.assertAllowed(url);
    await browser.view.webContents.loadURL(url);
  }

  async action(id: string, action: BrowserAction): Promise<void> {
    const browser = this.require(id);
    const contents = browser.view.webContents;
    switch (action) {
      case 'back':
        if (contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
        break;
      case 'forward':
        if (contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
        break;
      case 'reload':
        contents.reload();
        break;
      case 'stop':
        contents.stop();
        break;
      case 'zoom-in':
        browser.autoFit = false;
        contents.setZoomFactor(clampZoom(contents.getZoomFactor() + 0.1));
        break;
      case 'zoom-out':
        browser.autoFit = false;
        contents.setZoomFactor(clampZoom(contents.getZoomFactor() - 0.1));
        break;
      case 'zoom-reset':
        browser.autoFit = false;
        contents.setZoomFactor(1);
        break;
      case 'fit':
        browser.autoFit = true;
        await this.fitToWidth(browser);
        break;
      case 'devtools':
        if (contents.isDevToolsOpened()) contents.closeDevTools();
        else contents.openDevTools({ mode: 'detach', activate: true });
        break;
    }
    this.emit(IPC.browserState, this.state(browser));
  }

  setBounds(id: string, bounds: Rectangle): void {
    const browser = this.require(id);
    const normalized = {
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height)),
    };
    const widthChanged = browser.bounds?.width !== normalized.width;
    browser.bounds = normalized;
    browser.view.setBounds(normalized);
    if (widthChanged && browser.autoFit) this.scheduleFit(browser);
  }

  hide(id: string): void {
    const browser = this.browsers.get(id);
    if (browser !== undefined) browser.view.setBounds(this.hiddenBounds());
  }

  close(id: string): void {
    const browser = this.browsers.get(id);
    if (browser === undefined) return;
    if (browser.fitTimer !== undefined) clearTimeout(browser.fitTimer);
    this.window.contentView.removeChildView(browser.view);
    browser.view.webContents.close();
    this.browsers.delete(id);
  }

  async screenshot(id: string): Promise<string> {
    const image = await this.require(id).view.webContents.capturePage();
    return image.toDataURL();
  }

  async inspect(id: string): Promise<{
    readonly url: string;
    readonly title: string;
    readonly text: string;
    readonly html: string;
  }> {
    const contents = this.require(id).view.webContents;
    const result = (await contents.executeJavaScript(`({
      text: document.body?.innerText?.slice(0, 50000) ?? '',
      html: document.documentElement?.outerHTML?.slice(0, 200000) ?? '',
      annotations: window.__ganymedeAnnotations ?? []
    })`)) as { text: string; html: string; annotations: unknown[] };
    return {
      url: contents.getURL(),
      title: contents.getTitle(),
      ...result,
    };
  }

  async annotate(id: string): Promise<BrowserAnnotation | undefined> {
    const browser = this.require(id);
    const contents = browser.view.webContents;
    const settings = this.settings();
    const accent = resolveAccentColor(settings, !nativeTheme.shouldUseDarkColors);
    const accentRgb = hexToRgbTriplet(accent) ?? '79, 168, 255';
    const selected = (await contents.executeJavaScript(`new Promise((resolve) => {
      if (typeof window.__ganymedeAnnotationCancel === 'function') {
        window.__ganymedeAnnotationCancel();
      }
      const banner = document.createElement('div');
      banner.id = '__ganymede_annotation_banner';
      banner.textContent = '点击页面元素，将截图附到对话框 · Esc 取消';
      Object.assign(banner.style, {
        position: 'fixed', zIndex: '2147483647', top: '12px', left: '50%',
        transform: 'translateX(-50%)', padding: '8px 12px', borderRadius: '8px',
        background: '#17191e', color: '#fff', font: '12px sans-serif',
        boxShadow: '0 8px 30px rgba(0,0,0,.35)', pointerEvents: 'none'
      });
      const highlight = document.createElement('div');
      highlight.id = '__ganymede_annotation_highlight';
      Object.assign(highlight.style, {
        position: 'fixed', zIndex: '2147483646', display: 'none',
        border: '2px solid ${accent}', borderRadius: '3px',
        background: 'rgba(${accentRgb},.12)', pointerEvents: 'none',
        boxSizing: 'border-box'
      });
      document.documentElement.appendChild(banner);
      document.documentElement.appendChild(highlight);
      let finished = false;
      const cleanup = () => {
        banner.remove();
        highlight.remove();
        document.removeEventListener('click', choose, true);
        document.removeEventListener('pointermove', move, true);
        document.removeEventListener('keydown', keydown, true);
        if (window.__ganymedeAnnotationCancel === cancel) {
          delete window.__ganymedeAnnotationCancel;
        }
      };
      const finish = (value) => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(value);
      };
      const cancel = () => finish(null);
      window.__ganymedeAnnotationCancel = cancel;
      const keydown = (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        cancel();
      };
      const targetAt = (event) => {
        const target = document.elementFromPoint(event.clientX, event.clientY);
        return target instanceof Element && target !== banner && target !== highlight ? target : null;
      };
      const move = (event) => {
        const element = targetAt(event);
        if (element === null) {
          highlight.style.display = 'none';
          return;
        }
        const rect = element.getBoundingClientRect();
        Object.assign(highlight.style, {
          display: 'block', left: rect.left + 'px', top: rect.top + 'px',
          width: rect.width + 'px', height: rect.height + 'px'
        });
      };
      const selectorFor = (element) => {
        if (element.id) return '#' + CSS.escape(element.id);
        const testId = element.getAttribute('data-testid');
        if (testId) return '[data-testid="' + CSS.escape(testId) + '"]';
        const parts = [];
        let current = element;
        while (current instanceof Element && parts.length < 4) {
          let part = current.tagName.toLowerCase();
          const classes = [...current.classList].filter(Boolean).slice(0, 2);
          if (classes.length > 0) part += '.' + classes.map(CSS.escape).join('.');
          const parent = current.parentElement;
          if (parent !== null) {
            const peers = [...parent.children].filter((child) => child.tagName === current.tagName);
            if (peers.length > 1) part += ':nth-of-type(' + (peers.indexOf(current) + 1) + ')';
          }
          parts.unshift(part);
          if (parent?.id) {
            parts.unshift('#' + CSS.escape(parent.id));
            break;
          }
          current = parent;
        }
        return parts.join(' > ');
      };
      const choose = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const element = targetAt(event);
        if (element === null) return;
        let visual = element;
        let rect = visual.getBoundingClientRect();
        while ((rect.width < 2 || rect.height < 2) && visual.parentElement !== null) {
          visual = visual.parentElement;
          rect = visual.getBoundingClientRect();
        }
        finish({
          tag: element.tagName.toLowerCase(),
          text: (element.textContent || visual.textContent || '').trim().slice(0, 500),
          html: element.outerHTML.slice(0, 2000),
          selector: selectorFor(element),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        });
      };
      document.addEventListener('click', choose, true);
      document.addEventListener('pointermove', move, true);
      document.addEventListener('keydown', keydown, true);
    })`)) as BrowserAnnotationSelection | null;
    if (selected === null) return undefined;
    const captureBounds = annotationCaptureBounds(selected.rect, browser.view.getBounds());
    const image = await contents.capturePage(captureBounds);
    const annotation: BrowserAnnotation = {
      id: randomUUID(),
      url: contents.getURL(),
      title: contents.getTitle() || 'Browser',
      ...selected,
      screenshot: image.toDataURL(),
    };
    await contents.executeJavaScript(
      `window.__ganymedeAnnotations = [...(window.__ganymedeAnnotations ?? []), ${JSON.stringify({
        ...annotation,
        screenshot: undefined,
      })}]`,
    );
    return annotation;
  }

  async click(id: string, x: number, y: number): Promise<void> {
    const contents = this.require(id).view.webContents;
    this.assertInteractionAllowed(contents.getURL());
    contents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    contents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
  }

  async type(id: string, text: string): Promise<void> {
    const contents = this.require(id).view.webContents;
    this.assertInteractionAllowed(contents.getURL());
    contents.insertText(text);
  }

  closeAll(): void {
    for (const id of [...this.browsers.keys()]) this.close(id);
  }

  private state(browser: ManagedBrowser): BrowserTab {
    const contents = browser.view.webContents;
    return {
      id: browser.id,
      sessionId: browser.sessionId,
      url: contents.getURL(),
      title: contents.getTitle() || 'Browser',
      loading: contents.isLoading(),
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
      zoomFactor: contents.getZoomFactor(),
      autoFit: browser.autoFit,
      devToolsOpen: contents.isDevToolsOpened(),
    };
  }

  private scheduleFit(browser: ManagedBrowser): void {
    if (browser.fitTimer !== undefined) clearTimeout(browser.fitTimer);
    browser.fitTimer = setTimeout(() => {
      browser.fitTimer = undefined;
      void this.fitToWidth(browser).then(() => {
        this.emit(IPC.browserState, this.state(browser));
      }).catch(() => undefined);
    }, 80);
  }

  private async fitToWidth(browser: ManagedBrowser): Promise<void> {
    const contents = browser.view.webContents;
    if (!browser.autoFit || contents.isDestroyed() || contents.isLoading()) return;
    const metrics = (await contents.executeJavaScript(`({
      viewportWidth: window.innerWidth,
      layoutWidth: Math.max(
        document.documentElement?.scrollWidth ?? 0,
        document.body?.scrollWidth ?? 0,
        document.documentElement?.offsetWidth ?? 0,
        document.body?.offsetWidth ?? 0,
        Number.parseFloat(getComputedStyle(document.documentElement).minWidth) || 0,
        document.body ? Number.parseFloat(getComputedStyle(document.body).minWidth) || 0 : 0,
        document.querySelector('meta[name="viewport"]') === null ? 1100 : 0,
        ...[...(document.body?.children ?? [])].slice(0, 200).map((element) => {
          const rect = element.getBoundingClientRect();
          return Math.max(rect.width, rect.right - Math.min(0, rect.left));
        }),
        window.innerWidth
      )
    })`)) as { readonly viewportWidth: number; readonly layoutWidth: number };
    if (metrics.viewportWidth <= 0 || metrics.layoutWidth <= 0) return;
    const current = contents.getZoomFactor();
    const next = clampZoom(current * Math.min(1, metrics.viewportWidth / metrics.layoutWidth));
    if (Math.abs(next - current) >= 0.01) contents.setZoomFactor(next);
  }

  private assertAllowed(url: string): void {
    const parsed = new URL(url);
    if (parsed.protocol === 'about:' || parsed.protocol === 'file:') return;
    const { browserBlocklist } = this.settings();
    if (browserBlocklist.some((host) => host === parsed.hostname)) {
      log.warn('blocked browser host', { host: parsed.hostname, url });
      throw new Error(`Blocked browser host: ${parsed.hostname}`);
    }
  }

  private assertInteractionAllowed(url: string): void {
    const parsed = new URL(url);
    if (parsed.protocol === 'about:' || parsed.protocol === 'file:') return;
    const { browserAllowlist } = this.settings();
    if (!browserAllowlist.some((host) => host === parsed.hostname)) {
      log.warn('browser interaction denied', { host: parsed.hostname, url });
      throw new Error(
        `Browser interaction with ${parsed.hostname} is not allowed. Add the host in Settings first.`,
      );
    }
  }

  private require(id: string): ManagedBrowser {
    const browser = this.browsers.get(id);
    if (browser === undefined) throw new Error('Browser tab no longer exists.');
    return browser;
  }

  private hiddenBounds(): Rectangle {
    return {
      x: this.window.getContentBounds().width + 20,
      y: 0,
      width: 1280,
      height: 800,
    };
  }
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return 'about:blank';
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (trimmed.includes('.') || trimmed.startsWith('localhost')) return `http://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

function clampZoom(value: number): number {
  return Math.min(2, Math.max(0.5, Math.round(value * 10) / 10));
}

function annotationCaptureBounds(rect: Rectangle, viewport: Rectangle): Rectangle {
  const padding = 12;
  const minimum = 48;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const width = Math.min(viewport.width, Math.max(minimum, Math.ceil(rect.width + padding * 2)));
  const height = Math.min(viewport.height, Math.max(minimum, Math.ceil(rect.height + padding * 2)));
  return {
    x: Math.max(0, Math.min(viewport.width - width, Math.floor(centerX - width / 2))),
    y: Math.max(0, Math.min(viewport.height - height, Math.floor(centerY - height / 2))),
    width,
    height,
  };
}
