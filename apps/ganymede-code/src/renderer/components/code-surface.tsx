import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

export const ganymedeHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#c792ea' },
  { tag: t.operator, color: '#89ddff' },
  { tag: t.string, color: '#c3e88d' },
  { tag: t.number, color: '#f78c6c' },
  { tag: t.comment, color: '#697098', fontStyle: 'italic' },
  { tag: t.propertyName, color: '#82aaff' },
  { tag: t.variableName, color: '#d9e0f2' },
  { tag: t.definition(t.variableName), color: '#82aaff' },
  { tag: t.typeName, color: '#ffcb6b' },
  { tag: t.className, color: '#ffcb6b' },
  { tag: t.tagName, color: '#f07178' },
  { tag: t.attributeName, color: '#ffcb6b' },
  { tag: t.bool, color: '#ff9cac' },
  { tag: t.null, color: '#ff9cac' },
  { tag: t.heading, color: '#82aaff', fontWeight: 'bold' },
  { tag: t.link, color: '#9ca9ff' },
  { tag: t.meta, color: '#89ddff' },
]);

export const ganymedeTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#0c0e12',
      color: '#cbd1dc',
      fontSize: '10.5px',
      fontFamily: 'var(--font-mono)',
    },
    '.cm-content': {
      caretColor: 'var(--accent)',
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.5',
      padding: '8px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--accent)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(var(--accent-rgb), 0.28)',
    },
    '.cm-gutters': {
      backgroundColor: '#0c0e12',
      color: '#5a6275',
      border: 'none',
      borderRight: '1px solid rgba(255, 255, 255, 0.04)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      color: '#9aa3b8',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      overflow: 'auto',
    },
  },
  { dark: true },
);

export function languageExtension(language: string | undefined): Extension | undefined {
  switch (language) {
    case 'json':
      return json();
    case 'javascript':
      return javascript({ jsx: true });
    case 'typescript':
      return javascript({ jsx: true, typescript: true });
    case 'html':
      return html();
    case 'css':
      return css();
    case 'markdown':
      return markdown();
    case 'python':
      return python();
    case 'rust':
      return rust();
    case 'sql':
      return sql();
    case 'xml':
      return xml();
    default:
      return undefined;
  }
}

export const CodeSurface = memo(function CodeSurface(props: {
  readonly value: string;
  readonly language?: string;
  readonly readOnly?: boolean;
  readonly onChange?: (value: string) => void;
  readonly maxHeight?: number | string;
  readonly className?: string;
  readonly deferUntilVisible?: boolean;
}): ReactNode {
  const extensions = useMemo(() => {
    const list: Extension[] = [
      ganymedeTheme,
      syntaxHighlighting(ganymedeHighlight),
      EditorView.lineWrapping,
    ];
    const lang = languageExtension(props.language);
    if (lang !== undefined) list.push(lang);
    if (props.readOnly === true) {
      list.push(EditorState.readOnly.of(true));
      list.push(EditorView.editable.of(false));
    }
    return list;
  }, [props.language, props.readOnly]);

  const maxHeight =
    props.maxHeight === undefined
      ? undefined
      : typeof props.maxHeight === 'number'
        ? `${String(props.maxHeight)}px`
        : props.maxHeight;
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [activated, setActivated] = useState(props.deferUntilVisible !== true);

  useEffect(() => {
    if (props.deferUntilVisible !== true || activated) return;
    const element = placeholderRef.current;
    if (element === null || typeof IntersectionObserver === 'undefined') {
      setActivated(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setActivated(true);
        observer.disconnect();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [activated, props.deferUntilVisible]);

  if (!activated) {
    return (
      <div
        className={`code-surface code-surface--placeholder${props.className ? ` ${props.className}` : ''}`}
        ref={placeholderRef}
        style={{ maxHeight }}
      >
        <pre className="code-surface-placeholder-content"><code>{props.value}</code></pre>
      </div>
    );
  }

  return (
    <div className={`code-surface${props.className ? ` ${props.className}` : ''}`} style={{ maxHeight }}>
      <CodeMirror
        value={props.value}
        height="100%"
        theme="none"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: props.readOnly !== true,
          highlightActiveLineGutter: props.readOnly !== true,
          searchKeymap: false,
          autocompletion: false,
        }}
        extensions={extensions}
        editable={props.readOnly !== true}
        onChange={props.onChange}
      />
    </div>
  );
});
