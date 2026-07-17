import { useMemo, type ReactNode } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, Decoration, GutterMarker, gutter, type DecorationSet } from '@codemirror/view';
import { EditorState, RangeSetBuilder, StateField, type Extension } from '@codemirror/state';
import { syntaxHighlighting } from '@codemirror/language';

import type { UnifiedDiffLine } from '../git-review';
import { ganymedeHighlight, ganymedeTheme, languageExtension } from './code-surface';

class DiffSignMarker extends GutterMarker {
  constructor(
    readonly sign: string,
    readonly className: string,
  ) {
    super();
  }

  override eq(other: DiffSignMarker): boolean {
    return this.sign === other.sign && this.className === other.className;
  }

  override toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.textContent = this.sign;
    el.className = this.className;
    return el;
  }
}

const addMarker = new DiffSignMarker('+', 'tool-diff-sign tool-diff-sign-add');
const deleteMarker = new DiffSignMarker('-', 'tool-diff-sign tool-diff-sign-del');

function lineClass(kind: UnifiedDiffLine['kind']): string | undefined {
  switch (kind) {
    case 'add':
      return 'git-diff-line-add';
    case 'delete':
      return 'git-diff-line-del';
    case 'header':
      return 'git-diff-line-header';
    case 'meta':
      return 'git-diff-line-meta';
    default:
      return undefined;
  }
}

function unifiedDiffDecorations(lines: readonly UnifiedDiffLine[]): Extension {
  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildLineDecorations(state, lines);
    },
    update(value, transaction) {
      if (transaction.docChanged) return buildLineDecorations(transaction.state, lines);
      return value.map(transaction.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  const signGutter = gutter({
    class: 'cm-tool-diff-sign-gutter',
    lineMarker(view, line) {
      const lineNumber = view.state.doc.lineAt(line.from).number;
      const diff = lines[lineNumber - 1];
      if (diff === undefined) return null;
      if (diff.kind === 'add') return addMarker;
      if (diff.kind === 'delete') return deleteMarker;
      return null;
    },
  });

  return [field, signGutter];
}

function buildLineDecorations(state: EditorState, lines: readonly UnifiedDiffLine[]): DecorationSet {
  const builder = new RangeSetBuilder<ReturnType<typeof Decoration.line>>();
  for (let index = 0; index < lines.length; index += 1) {
    const lineInfo = lines[index]!;
    const className = lineClass(lineInfo.kind);
    if (className === undefined) continue;
    if (index + 1 > state.doc.lines) break;
    const line = state.doc.line(index + 1);
    builder.add(line.from, line.from, Decoration.line({ class: className }));
  }
  return builder.finish();
}

export function GitDiffSurface(props: {
  readonly lines: readonly UnifiedDiffLine[];
  readonly language?: string;
  readonly className?: string;
}): ReactNode {
  const value = useMemo(() => props.lines.map((line) => line.text).join('\n'), [props.lines]);

  const extensions = useMemo(() => {
    const list: Extension[] = [
      ganymedeTheme,
      syntaxHighlighting(ganymedeHighlight),
      EditorView.lineWrapping,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      unifiedDiffDecorations(props.lines),
    ];
    const lang = languageExtension(props.language);
    if (lang !== undefined) list.push(lang);
    return list;
  }, [props.language, props.lines]);

  return (
    <div className={`code-surface git-diff-surface${props.className ? ` ${props.className}` : ''}`}>
      <CodeMirror
        value={value}
        height="100%"
        theme="none"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          searchKeymap: false,
          autocompletion: false,
        }}
        extensions={extensions}
        editable={false}
      />
    </div>
  );
}
