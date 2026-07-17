import { memo, type ReactNode } from 'react';

import { StreamingTextTail } from './streaming-text-reveal';

export const StreamingThinkingBody = memo(function StreamingThinkingBody(props: {
  readonly content: string;
  readonly streaming: boolean;
}): ReactNode {
  const streaming = props.streaming === true;
  if (!streaming) {
    return <div className="thinking-body">{props.content}</div>;
  }

  return (
    <div className="thinking-body is-streaming">
      {props.content.length > 0 ? (
        <StreamingTextTail text={props.content} variant="thinking" />
      ) : null}
    </div>
  );
});
