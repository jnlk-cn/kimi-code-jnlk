import { useState, type ReactNode } from 'react';
import { ChevronDown, FilePlus2, Undo2, X } from 'lucide-react';

import {
  splitEditPath,
  visibleTurnFiles,
  type SessionTurn,
} from '../session-turns';

const api = window.ganymede;

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function TurnEditsSummaryBar(props: {
  readonly turn: SessionTurn;
  readonly workDir?: string;
  readonly isGitRepository?: boolean;
  readonly onOpenReview: () => void;
  readonly onPreviewFile?: (relativePath: string) => void;
  readonly onError: (message: string) => void;
  readonly onReverted?: () => void;
}): ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [reverting, setReverting] = useState(false);
  const { visible, hidden } = visibleTurnFiles(props.turn.fileEdits, expanded);
  const canRevert = props.isGitRepository === true && props.workDir !== undefined && props.workDir.length > 0;
  const fileCount = props.turn.fileEdits.length;

  async function revertTurnFiles(): Promise<void> {
    if (!canRevert || props.workDir === undefined) return;
    setReverting(true);
    try {
      await api.gitRevert(
        props.workDir,
        props.turn.fileEdits.map((edit) => edit.path),
      );
      setConfirmRevert(false);
      props.onReverted?.();
    } catch (cause) {
      props.onError(messageOf(cause));
    } finally {
      setReverting(false);
    }
  }

  return (
    <>
      <div className="turn-edits-summary">
        <div className="turn-edits-summary-header">
          <div className="turn-edits-summary-title">
            <span className="turn-edits-summary-icon" aria-hidden>
              <FilePlus2 size={14} />
            </span>
            <div className="turn-edits-summary-heading">
              <strong>已编辑 {fileCount} 个文件</strong>
              <div className="turn-edits-summary-totals">
                <span className="add">+{props.turn.totalAdditions}</span>
                <span className="del">-{props.turn.totalDeletions}</span>
              </div>
            </div>
          </div>
          <div className="turn-edits-summary-actions">
            <button
              type="button"
              className="turn-edits-summary-undo"
              disabled={!canRevert || reverting}
              title={canRevert ? '撤销本回合对工作区的改动' : '需要 Git 仓库'}
              onClick={() => setConfirmRevert(true)}
            >
              <Undo2 size={14} />
              撤销
            </button>
            <button
              type="button"
              className="turn-edits-summary-review"
              onClick={props.onOpenReview}
            >
              审核
            </button>
          </div>
        </div>

        <ul className="turn-edits-summary-list">
          {visible.map((edit) => {
            const parts = splitEditPath(edit.path);
            return (
              <li key={edit.path}>
                <button
                  type="button"
                  className="turn-edits-summary-file"
                  onClick={() => props.onPreviewFile?.(edit.path)}
                  title={edit.path}
                >
                  <span className="turn-edits-summary-path">
                    {parts.dir.length > 0 ? (
                      <span className="dir">{parts.dir}/</span>
                    ) : null}
                    <span className="name">{parts.name}</span>
                  </span>
                  <span className="turn-edits-summary-stats">
                    <span className="add">+{edit.additions}</span>
                    <span className="del">-{edit.deletions}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {hidden > 0 ? (
          <button
            type="button"
            className="turn-edits-summary-footer"
            onClick={() => setExpanded(true)}
          >
            再显示 {hidden} 个文件
            <ChevronDown size={14} />
          </button>
        ) : null}
        {expanded && fileCount > 3 ? (
          <button
            type="button"
            className="turn-edits-summary-footer"
            onClick={() => setExpanded(false)}
          >
            收起
            <ChevronDown size={14} className="open" />
          </button>
        ) : null}
      </div>

      {confirmRevert ? (
        <div className="modal-backdrop">
          <div className="modal">
            <header>
              <strong>撤销本回合改动</strong>
              <button
                aria-label="关闭"
                type="button"
                onClick={() => setConfirmRevert(false)}
              >
                <X size={16} />
              </button>
            </header>
            <div className="modal-body">
              <div className="confirm-sheet">
                <p>
                  确定撤销本回合对 {fileCount} 个文件的未提交改动吗？此操作不可撤销。
                </p>
                <div className="modal-actions">
                  <button type="button" onClick={() => setConfirmRevert(false)}>
                    取消
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={reverting}
                    onClick={() => void revertTurnFiles()}
                  >
                    {reverting ? '撤销中…' : '撤销改动'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
