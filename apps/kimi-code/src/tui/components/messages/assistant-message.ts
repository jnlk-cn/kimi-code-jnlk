/**
 * Renders an assistant message using pi-tui Markdown.
 *
 * Displays a white bullet prefix with markdown content indented
 * to align after the bullet.
 */

import { Container, truncateToWidth, visibleWidth, type Component, type TuiMouseDispatchResult, type TuiMouseEvent } from '@moonshot-ai/pi-tui';

import { Markdown } from '#/tui/components/markdown/markdown';
import { STREAMING_MARKDOWN_MAX_CHARS } from '#/tui/constant/streaming';
import { MESSAGE_INDENT } from '#/tui/constant/rendering';
import { STATUS_BULLET } from '#/tui/constant/symbols';
import { currentTheme } from '#/tui/theme';
import { createMarkdownTheme } from '#/tui/theme/pi-tui-theme';
import { createMarkdownOptions } from '#/tui/utils/markdown-options';
import { markOsc133Zone } from '#/tui/utils/osc133';
import { isRenderCacheEnabled } from '#/tui/utils/render-cache';

type AssistantMarkdownOptions = {
  transient?: boolean;
  streaming?: boolean;
};

const STREAMING_TAIL_MARKER = '…';

/**
 * While a message streams, the whole text would re-parse on every flush — for
 * long answers that is seconds of blocked event loop. Parse only a bounded
 * tail starting at a block boundary; the final render uses the full text.
 */
function streamedMarkdownSource(text: string): string {
  if (text.length <= STREAMING_MARKDOWN_MAX_CHARS) return text;
  const tail = text.slice(text.length - STREAMING_MARKDOWN_MAX_CHARS);
  const boundary = tail.indexOf('\n\n', Math.floor(tail.length / 4));
  const kept = boundary >= 0 ? tail.slice(boundary + 2) : tail;
  return `${STREAMING_TAIL_MARKER}\n\n${kept}`;
}

export class AssistantMessageComponent implements Component {
  private contentContainer: Container;
  private markdown: Markdown | undefined;
  private markdownTransient = false;
  private lastText = '';
  private lastTransient = false;
  private lastStreaming = false;
  private lastSource = '';
  private showBullet: boolean;

  private renderCache: { width: number; lines: string[] } | undefined;

  constructor(showBullet: boolean = true) {
    this.showBullet = showBullet;
    this.contentContainer = new Container();
  }

  private markRenderDirty(): void {
    this.renderCache = undefined;
  }

  setShowBullet(show: boolean): void {
    if (this.showBullet === show) return;
    this.showBullet = show;
    this.markRenderDirty();
  }

  updateContent(text: string, opts?: AssistantMarkdownOptions): void {
    const displayText = text.trim();
    const transient = opts?.transient === true;
    const streaming = opts?.streaming === true;

    if (
      displayText === this.lastText &&
      transient === this.lastTransient &&
      streaming === this.lastStreaming
    ) {
      return;
    }

    this.lastText = displayText;
    this.lastTransient = transient;
    this.lastStreaming = streaming;
    const source = streaming ? streamedMarkdownSource(displayText) : displayText;
    this.markRenderDirty();

    if (displayText.length === 0) {
      this.contentContainer.clear();
      this.markdown = undefined;
      this.markdownTransient = false;
      this.lastSource = '';
      return;
    }

    if (this.markdown === undefined || this.markdownTransient !== transient) {
      this.contentContainer.clear();
      this.markdown = new Markdown(
        source,
        0,
        0,
        createMarkdownTheme({ transient }),
        undefined,
        {
          ...createMarkdownOptions(),
          copySource: true,
          onVisualStateChange: () => this.markRenderDirty(),
        },
      );
      this.markdownTransient = transient;
      this.lastSource = source;
      this.contentContainer.addChild(this.markdown);
      return;
    }

    const previousSource = this.lastSource;
    this.lastSource = source;
    if (previousSource === source) return;
    this.markdown.setText(source);
  }

  invalidate(): void {
    // Markdown caches ANSI colour codes keyed on (text, width).  When the
    // theme changes the cached strings contain stale colours, so we rebuild
    // the Markdown child with the new theme while preserving transient mode.
    this.markRenderDirty();
    this.contentContainer.clear();
    this.markdown = undefined;

    if (this.lastText.trim().length > 0) {
      const source = this.lastStreaming
        ? streamedMarkdownSource(this.lastText.trim())
        : this.lastText.trim();
      this.markdown = new Markdown(
        source,
        0,
        0,
        createMarkdownTheme({ transient: this.lastTransient }),
        undefined,
        {
          ...createMarkdownOptions(),
          copySource: true,
          onVisualStateChange: () => this.markRenderDirty(),
        },
      );
      this.markdownTransient = this.lastTransient;
      this.lastSource = source;
      this.contentContainer.addChild(this.markdown);
    }
  }

  handleMouse(event: TuiMouseEvent): TuiMouseDispatchResult | undefined {
    if (this.lastText.trim().length === 0) return undefined;

    const prefix = this.showBullet ? STATUS_BULLET : MESSAGE_INDENT;
    const prefixWidth = visibleWidth(prefix);
    const contentWidth = Math.max(1, Math.max(0, event.width) - prefixWidth);
    const y = event.y - 1;
    if (y < 0) return undefined;

    const contentHeight = this.contentContainer.render(contentWidth).length;
    if (y >= contentHeight) return undefined;

    return this.contentContainer.handleMouse({
      ...event,
      x: event.x - prefixWidth,
      y,
      width: contentWidth,
      height: contentHeight,
    });
  }

  render(width: number): string[] {
    if (this.lastText.trim().length === 0) return [];

    const safeWidth = Math.max(0, width);
    if (safeWidth <= 0) return [''];

    if (
      isRenderCacheEnabled() &&
      this.renderCache !== undefined &&
      this.renderCache.width === safeWidth
    ) {
      return this.renderCache.lines;
    }

    const prefix = this.showBullet ? STATUS_BULLET : MESSAGE_INDENT;
    const contentWidth = Math.max(1, safeWidth - visibleWidth(prefix));
    const contentLines = this.contentContainer.render(contentWidth);

    const lines: string[] = [''];
    for (let i = 0; i < contentLines.length; i++) {
      const p =
        i === 0 && this.showBullet ? currentTheme.fg('text', STATUS_BULLET) : MESSAGE_INDENT;
      lines.push(p + contentLines[i]);
    }
    const rendered = markOsc133Zone(lines.map((line) => truncateToWidth(line, safeWidth, '…')));
    if (isRenderCacheEnabled()) {
      this.renderCache = { width: safeWidth, lines: rendered };
    }
    return rendered;
  }
}
