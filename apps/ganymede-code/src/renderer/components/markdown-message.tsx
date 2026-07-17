import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { memo, useMemo, type ReactNode } from 'react';
import { FileText, Globe2 } from 'lucide-react';

import { isWorkspaceSpecPath } from '../../shared/plan-paths';
import { isHtmlPath, languageFromFence, languageFromPath } from '../language-from-path';
import { CodeSurface } from './code-surface';
import { MermaidDiagram } from './mermaid-diagram';

const PREVIEWABLE_FILE_RE = /^[\w./\\-]+\.(html?|htm|md|css|js|mjs|ts|tsx|json)$/i;

function looksLikeWorkspacePath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.includes('://') || trimmed.includes(' ')) return false;
  return PREVIEWABLE_FILE_RE.test(trimmed) || trimmed.startsWith('./') || trimmed.startsWith('../');
}

function resolveRelativePath(workDir: string | undefined, raw: string): string | undefined {
  const trimmed = raw.trim().replace(/^file:\/\//, '');
  if (trimmed.length === 0) return undefined;
  if (workDir !== undefined && trimmed.startsWith(workDir)) {
    const relative = trimmed.slice(workDir.length).replace(/^[/\\]+/, '');
    return relative.length > 0 ? relative : undefined;
  }
  if (trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    // Absolute path outside known workDir — still try basename-relative if it looks like a file
    if (isHtmlPath(trimmed) || isWorkspaceSpecPath(trimmed, workDir)) {
      if (isWorkspaceSpecPath(trimmed, workDir)) return trimmed;
      const parts = trimmed.split(/[/\\]/);
      return parts.at(-1);
    }
    return undefined;
  }
  return trimmed.replace(/^\.\//, '');
}

export const MarkdownMessage = memo(function MarkdownMessage(props: {
  readonly content: string;
  readonly workDir?: string;
  readonly onPreviewFile?: (relativePath: string) => void;
  readonly onOpenPlanPath?: (path: string) => void;
  readonly onOpenExternal?: (url: string) => void;
}): ReactNode {
  const components = useMemo<Components>(() => ({
    a({ href, children }) {
      const url = href ?? '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return (
          <a
            href={url}
            rel="noreferrer noopener"
            onClick={(event) => {
              event.preventDefault();
              props.onOpenExternal?.(url);
            }}
          >
            {children}
          </a>
        );
      }
      if (url.startsWith('file:') || looksLikeWorkspacePath(url)) {
        const relative = resolveRelativePath(props.workDir, url);
        if (relative !== undefined && isHtmlPath(relative)) {
          return (
            <button
              type="button"
              className="markdown-file-chip"
              onClick={() => props.onPreviewFile?.(relative)}
              title="在内置浏览器打开"
            >
              <Globe2 size={12} />
              <span>{children}</span>
            </button>
          );
        }
        if (
          relative !== undefined
          && props.onOpenPlanPath !== undefined
          && isWorkspaceSpecPath(relative, props.workDir)
        ) {
          return (
            <button
              type="button"
              className="markdown-file-chip"
              onClick={() => props.onOpenPlanPath?.(relative)}
              title="在计划面板打开"
            >
              <FileText size={12} />
              <span>{children}</span>
            </button>
          );
        }
      }
      return <a href={href}>{children}</a>;
    },
    table({ children, ...rest }) {
      return (
        <div aria-label="Markdown 表格" className="markdown-table-wrap" role="region" tabIndex={0}>
          <table {...rest}>{children}</table>
        </div>
      );
    },
    img({ alt, ...rest }) {
      return (
        <img
          {...rest}
          alt={alt ?? ''}
          className="markdown-image"
          decoding="async"
          loading="lazy"
        />
      );
    },
    code({ className, children, ...rest }) {
      const text = String(children).replace(/\n$/, '');
      const isBlock = className?.startsWith('language-') || text.includes('\n');
      if (isBlock) {
        const lang = languageFromFence(className?.replace(/^language-/, ''));
        if (lang === 'mermaid') {
          return <MermaidDiagram source={text} className="markdown-mermaid" />;
        }
        return (
          <CodeSurface
            value={text}
            language={lang}
            readOnly
            deferUntilVisible
            maxHeight={360}
            className="markdown-code"
          />
        );
      }
      if (looksLikeWorkspacePath(text)) {
        const relative = resolveRelativePath(props.workDir, text);
        if (
          relative !== undefined
          && isHtmlPath(relative)
          && props.onPreviewFile !== undefined
        ) {
          return (
            <button
              type="button"
              className="markdown-file-chip inline"
              onClick={() => props.onPreviewFile?.(relative)}
              title="在内置浏览器打开"
            >
              <code {...rest}>{text}</code>
              <Globe2 size={11} />
            </button>
          );
        }
        if (
          relative !== undefined
          && props.onOpenPlanPath !== undefined
          && isWorkspaceSpecPath(relative, props.workDir)
        ) {
          return (
            <button
              type="button"
              className="markdown-file-chip inline"
              onClick={() => props.onOpenPlanPath?.(relative)}
              title="在计划面板打开"
            >
              <code {...rest}>{text}</code>
              <FileText size={11} />
            </button>
          );
        }
        if (relative !== undefined) {
          return (
            <code className="markdown-path" title={languageFromPath(relative)} {...rest}>
              {text}
            </code>
          );
        }
      }
      return <code {...rest}>{children}</code>;
    },
    pre({ children }) {
      return <div className="markdown-pre">{children}</div>;
    },
  }), [props.onOpenExternal, props.onOpenPlanPath, props.onPreviewFile, props.workDir]);

  // Also surface bare `foo.html` mentions outside code fences.
  const enhanced = useMemo(() => enhanceBareHtmlMentions(props.content), [props.content]);

  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {enhanced}
      </ReactMarkdown>
    </div>
  );
});

function enhanceBareHtmlMentions(content: string): string {
  return content.replace(
    /(^|[\s"'`（(])([\w./-]+\.(?:html?|htm))(?=$|[\s"'`，。、）),:;!?])/gi,
    (match, prefix: string, file: string) => {
      // Skip if already wrapped in backticks or markdown link
      if (prefix.endsWith('`') || prefix.endsWith('[')) return match;
      return `${prefix}\`${file}\``;
    },
  );
}
