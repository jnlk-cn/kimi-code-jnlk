import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Code2, Globe2, LoaderCircle } from 'lucide-react';

import type { AgentSubagentView } from '../agent-subagent';
import type { TimelineEntry } from '../timeline';
import { buildToolDiffLines, computeToolChangeStats } from '../tool-change-stats';
import { fileTypeBadge, parseToolDisplayFromEntry, toolDisplayTitle } from '../tool-display';
import { AgentSubagentProgressView } from './agent-subagent-progress';
import { CodeSurface } from './code-surface';
import { ToolDiffSurface } from './tool-diff-surface';

export const ToolBlockView = memo(function ToolBlockView(props: {
  readonly entry: TimelineEntry;
  readonly workDir?: string;
  readonly subagent?: AgentSubagentView;
  readonly onPreviewFile?: (relativePath: string) => void;
  readonly onOpenInEditor?: (absoluteOrRelativePath: string) => void;
}): ReactNode {
  const { entry } = props;
  const display = parseToolDisplayFromEntry(entry);
  const subtitle = toolDisplayTitle(display);
  const badge = fileTypeBadge(display.path);
  const toolStatus = entry.streaming ? 'running' : entry.error ? 'failed' : 'completed';
  const toolStatusLabel = entry.streaming ? '运行中' : entry.error ? '失败' : '完成';
  const stats = entry.streaming ? undefined : computeToolChangeStats(entry.title, entry.toolArgs);
  const diffLines =
    entry.streaming === true ? undefined : buildToolDiffLines(entry.title, entry.toolArgs);
  const useDiff = diffLines !== undefined && (display.mode === 'write' || display.mode === 'edit');
  const subagentActive =
    props.subagent !== undefined &&
    (props.subagent.phase === 'running' ||
      props.subagent.phase === 'queued' ||
      props.subagent.phase === 'suspended');
  const forcedOpen = entry.streaming === true || subagentActive;
  const [expanded, setExpanded] = useState(forcedOpen);
  const wasForcedOpen = useRef(forcedOpen);

  useEffect(() => {
    if (forcedOpen) setExpanded(true);
    else if (wasForcedOpen.current) setExpanded(false);
    wasForcedOpen.current = forcedOpen;
  }, [forcedOpen]);

  const open = forcedOpen || expanded;

  return (
    <details
      className={`tool-block${entry.error ? ' error' : ''}`}
      open={open}
      onToggle={(event) => {
        if (!forcedOpen) setExpanded(event.currentTarget.open);
      }}
    >
      <summary onClick={forcedOpen ? (event) => event.preventDefault() : undefined}>
        {entry.streaming ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}
        <strong>{entry.title ?? '工具'}</strong>
        <span className="tool-summary-meta">
          {stats !== undefined ? (
            <span className="tool-change-stats">
              {stats.additions > 0 ? <span className="tool-line-add">+{stats.additions}</span> : null}
              {stats.deletions > 0 ? <span className="tool-line-del">-{stats.deletions}</span> : null}
            </span>
          ) : null}
          <span className={`tool-status ${toolStatus}`}>{toolStatusLabel}</span>
          <ChevronDown size={14} />
        </span>
      </summary>
      {open && (props.subagent !== undefined || entry.content.length > 0 || entry.toolArgs !== undefined) ? (
        <div className="tool-block-body">
          {props.subagent !== undefined ? (
            <AgentSubagentProgressView subagent={props.subagent} />
          ) : null}
          {subtitle !== undefined ? (
            <div className="tool-block-meta">
              <div className="tool-block-meta-path">
                {badge !== undefined ? <span className="tool-file-badge">{badge}</span> : null}
                <code>{subtitle}</code>
              </div>
              <div className="tool-block-actions">
                {display.previewable && props.onPreviewFile !== undefined && display.path !== undefined ? (
                  <button
                    aria-label="在内置浏览器预览"
                    className="icon-button"
                    title="在内置浏览器预览"
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      props.onPreviewFile?.(display.path!);
                    }}
                  >
                    <Globe2 size={13} />
                  </button>
                ) : null}
                {display.path !== undefined && props.onOpenInEditor !== undefined ? (
                  <button
                    aria-label="在外部编辑器打开"
                    className="icon-button"
                    title="在外部编辑器打开"
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      props.onOpenInEditor?.(display.path!);
                    }}
                  >
                    <Code2 size={13} />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {props.subagent === undefined && useDiff ? (
            <ToolDiffSurface lines={diffLines} language={display.language} maxHeight={300} className="tool-code" />
          ) : props.subagent === undefined ? (
            <CodeSurface
              value={display.code}
              language={display.language}
              readOnly
              maxHeight={300}
              className="tool-code"
            />
          ) : null}
        </div>
      ) : null}
    </details>
  );
});
