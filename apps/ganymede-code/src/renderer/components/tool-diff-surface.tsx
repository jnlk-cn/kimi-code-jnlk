import { useMemo, type ReactNode } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, Decoration, GutterMarker, gutter, type DecorationSet } from '@codemirror/view';
import { EditorState, RangeSetBuilder, StateField, type Extension } from '@codemirror/state';
import { syntaxHighlighting } from '@codemirror/language';

import type { DiffLine } from '../tool-change-stats';
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

function diffDecorationsExtension(lines: readonly DiffLine[]): Extension {
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
      return diff.kind === 'add' ? addMarker : deleteMarker;
    },
  });

  return [field, signGutter];
}

function buildLineDecorations(state: EditorState, lines: readonly DiffLine[]): DecorationSet {
  const builder = new RangeSetBuilder<ReturnType<typeof Decoration.line>>();
  for (let index = 0; index < lines.length; index += 1) {
    const lineInfo = lines[index]!;
    if (index + 1 > state.doc.lines) break;
    const line = state.doc.line(index + 1);
    builder.add(
      line.from,
      line.from,
      Decoration.line({
        class: lineInfo.kind === 'add' ? 'tool-diff-line-add' : 'tool-diff-line-del',
      }),
    );
  }
  return builder.finish();
}

export function ToolDiffSurface(props: {
  readonly lines: readonly DiffLine[];
  readonly language?: string;
  readonly maxHeight?: number | string;
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
      diffDecorationsExtension(props.lines),
    ];
    const lang = languageExtension(props.language);
    if (lang !== undefined) list.push(lang);
    return list;
  }, [props.language, props.lines]);

  const maxHeight =
    props.maxHeight === undefined
      ? undefined
      : typeof props.maxHeight === 'number'
        ? `${String(props.maxHeight)}px`
        : props.maxHeight;

  return (
    <div className={`code-surface tool-diff-surface${props.className ? ` ${props.className}` : ''}`} style={{ maxHeight }}>
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
