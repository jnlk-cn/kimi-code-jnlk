import type { ReactNode } from 'react';

const STREAM_REVEAL_GLYPH_LIMIT = 32;

interface RevealGlyph {
  readonly index: number;
  readonly value: string;
}

function splitRevealTail(text: string): {
  readonly prefix: string;
  readonly glyphs: readonly RevealGlyph[];
} {
  const glyphs: RevealGlyph[] = [];
  let cursor = text.length;
  while (cursor > 0 && glyphs.length < STREAM_REVEAL_GLYPH_LIMIT) {
    const last = text.charCodeAt(cursor - 1);
    const startsWithSurrogatePair =
      last >= 0xdc00 &&
      last <= 0xdfff &&
      cursor > 1 &&
      text.charCodeAt(cursor - 2) >= 0xd800 &&
      text.charCodeAt(cursor - 2) <= 0xdbff;
    const start = cursor - (startsWithSurrogatePair ? 2 : 1);
    glyphs.unshift({ index: start, value: text.slice(start, cursor) });
    cursor = start;
  }
  return { prefix: text.slice(0, cursor), glyphs };
}

export function StreamingTextTail(props: {
  readonly text: string;
  readonly variant: 'assistant' | 'thinking';
}): ReactNode {
  if (props.text.length === 0) return null;
  const className =
    props.variant === 'assistant' ? 'assistant-stream-tail' : 'thinking-stream-tail';
  const { prefix, glyphs } = splitRevealTail(props.text);
  return (
    <span aria-label={props.text} className={className}>
      <span aria-hidden="true">{prefix}</span>
      <span aria-hidden="true" className="stream-reveal-run">
        {glyphs.map((glyph) => (
          <span
            className="stream-reveal-glyph"
            key={glyph.index}
            style={{ animationDelay: `${String((glyph.index % 8) * 5)}ms` }}
          >
            {glyph.value}
          </span>
        ))}
      </span>
    </span>
  );
}
