import { memo, type ReactNode } from 'react';

import { MarkdownMessage } from './markdown-message';
import { StreamingTextTail } from './streaming-text-reveal';

export const StreamingAssistantMessage = memo(function StreamingAssistantMessage(props: {
  readonly content: string;
  readonly streaming: boolean;
  readonly workDir?: string;
  readonly onPreviewFile?: (relativePath: string) => void;
  readonly onOpenPlanPath?: (path: string) => void;
  readonly onOpenExternal?: (url: string) => void;
}): ReactNode {
  const streaming = props.streaming === true;
  if (!streaming) {
    return (
      <article className="message assistant-message">
        <MarkdownMessage
          content={props.content}
          workDir={props.workDir}
          onPreviewFile={props.onPreviewFile}
          onOpenPlanPath={props.onOpenPlanPath}
          onOpenExternal={props.onOpenExternal}
        />
      </article>
    );
  }

  return (
    <article className="message assistant-message is-streaming">
      {props.content.length > 0 ? (
        <StreamingTextTail text={props.content} variant="assistant" />
      ) : null}
    </article>
  );
});
