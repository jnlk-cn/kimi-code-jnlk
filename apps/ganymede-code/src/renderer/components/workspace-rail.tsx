import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { WorkspaceToolDock } from './workspace-panel-tabs';
import { workspacePanelMeta, type WorkspacePanel } from './workspace-panels';
import type { WorkspaceRailHeaderMode } from './workspace-rail-chrome';

export const RAIL_CHROME_WIDTH = 44;

export function WorkspaceRail(props: {
  readonly panel: WorkspacePanel;
  readonly onPanel: (panel: WorkspacePanel) => void;
  readonly inboxUnreadCount?: number;
  readonly resizable: boolean;
  readonly onResizeStart?: (clientX: number) => void;
  readonly children?: ReactNode;
  readonly header?: ReactNode;
  readonly headerMode?: WorkspaceRailHeaderMode;
}): ReactNode {
  const contentOpen = props.children != null && props.panel !== 'none';
  const meta = props.panel === 'none'
    ? undefined
    : workspacePanelMeta(props.panel);
  const Icon = meta?.icon;
  const useTabHeader = props.header !== undefined;

  return (
    <aside
      className={`workspace-rail${contentOpen ? ' rail-expanded' : ' rail-chrome'}`}
      aria-label="右侧栏"
    >
      {contentOpen && meta !== undefined ? (
        <section className="workspace-rail-content" aria-label={`${meta.label}面板`}>
          {props.resizable && props.onResizeStart !== undefined ? (
            <div
              aria-hidden="true"
              className="workspace-rail-resize-handle"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                props.onResizeStart?.(event.clientX);
              }}
            />
          ) : null}
          <header
            className={`workspace-rail-content__header${
              useTabHeader && props.headerMode === 'tabs'
                ? ' workspace-rail-content__header--tabs'
                : ''
            }`}
          >
            {useTabHeader ? (
              props.header
            ) : (
              <>
                <span className="workspace-rail-content__icon">
                  {Icon === undefined ? null : <Icon size={15} />}
                </span>
                <strong>{meta.label}</strong>
                {meta.shortcut.length === 0 ? null : <kbd>{meta.shortcut}</kbd>}
                <button
                  aria-label={`关闭${meta.label}面板`}
                  onClick={() => props.onPanel('none')}
                  title={`关闭${meta.label}面板`}
                  type="button"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </header>
          <div className="workspace-rail-content__body">{props.children}</div>
        </section>
      ) : null}
      <WorkspaceToolDock
        inboxUnreadCount={props.inboxUnreadCount}
        panel={props.panel}
        onPanel={props.onPanel}
      />
    </aside>
  );
}
