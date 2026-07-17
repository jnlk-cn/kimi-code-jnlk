import { LoaderCircle, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import type { AppSettings } from '../../shared/contracts';
import { anchorFromElement, type MenuAnchor } from '../app-menu';
import {
  indexBadgeLabel,
  indexStatusTitle,
  useProjectIndexStatus,
} from '../project-index-status';
import { IndexStatusPopover } from './index-status-popover';

const api = window.ganymede;

export function TopbarIndexStatus(props: {
  readonly workDir?: string;
  readonly additionalDirs?: readonly string[];
  readonly onSettings?: (settings: AppSettings) => void;
  readonly onRequestRiskConfirm?: () => void;
}): ReactNode {
  const [popover, setPopover] = useState<{ readonly anchor: MenuAnchor }>();
  const indexStatus = useProjectIndexStatus(props.workDir);
  if (props.workDir === undefined) return null;

  const label = indexBadgeLabel(indexStatus);
  const stateClass =
    indexStatus?.state === 'error' || indexStatus?.state === 'blocked'
      ? ' error'
      : indexStatus?.state === 'indexing'
        ? ' indexing'
        : indexStatus?.state === 'idle' ||
            indexStatus?.state === 'disabled' ||
            indexStatus === undefined
          ? ' inactive'
          : '';

  return (
    <>
      <button
        aria-expanded={popover !== undefined}
        aria-haspopup="dialog"
        aria-label="项目索引"
        className={`topbar-index-status${stateClass}`}
        onClick={(event) => {
          if (indexStatus?.state === 'blocked' && props.onRequestRiskConfirm !== undefined) {
            props.onRequestRiskConfirm();
            return;
          }
          const anchor = anchorFromElement(event.currentTarget);
          setPopover((current) => (current === undefined ? { anchor } : undefined));
        }}
        title={indexStatusTitle(indexStatus)}
        type="button"
      >
        {indexStatus?.state === 'indexing' ? (
          <LoaderCircle size={11} className="spin" />
        ) : (
          <Search size={11} />
        )}
        <span>{label}</span>
      </button>
      {popover !== undefined ? (
        <IndexStatusPopover
          anchor={popover.anchor}
          indexStatus={indexStatus}
          onCancelIndex={
            props.workDir === undefined
              ? undefined
              : () => {
                  void api.cancelProjectIndex(props.workDir!).finally(() => setPopover(undefined));
                }
          }
          onClose={() => setPopover(undefined)}
          onDisableIndex={() => {
            void api
              .setSettings({ indexEnabled: false })
              .then((next) => props.onSettings?.(next))
              .finally(() => setPopover(undefined));
          }}
          onForceIndex={
            props.workDir === undefined
              ? undefined
              : () => {
                  void api
                    .activateProjectIndex(props.workDir!, props.additionalDirs ?? [], {
                      force: true,
                    })
                    .finally(() => setPopover(undefined));
                }
          }
          onStartIndex={
            props.workDir === undefined
              ? undefined
              : () => {
                  void api
                    .activateProjectIndex(props.workDir!, props.additionalDirs ?? [])
                    .finally(() => setPopover(undefined));
                }
          }
          onEnableIndex={() => {
            void api
              .setSettings({ indexEnabled: true })
              .then((next) => {
                props.onSettings?.(next);
                if (props.workDir === undefined) return;
                return api.activateProjectIndex(props.workDir, props.additionalDirs ?? []);
              })
              .finally(() => setPopover(undefined));
          }}
        />
      ) : null}
    </>
  );
}
