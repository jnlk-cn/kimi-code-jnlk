import { Fragment, type ReactNode } from 'react';

import {
  toggleWorkspacePanel,
  WORKSPACE_DOCK_SECTIONS,
  type WorkspacePanel,
} from './workspace-panels';

export function WorkspaceToolDock(props: {
  readonly panel: WorkspacePanel;
  readonly onPanel: (panel: WorkspacePanel) => void;
  readonly inboxUnreadCount?: number;
}): ReactNode {
  return (
    <div className="workspace-tool-dock" aria-label="工作区工具">
      <div className="workspace-tool-dock__items">
        {WORKSPACE_DOCK_SECTIONS.map((section, sectionIndex) => (
          <Fragment key={section.items[0]?.panel ?? sectionIndex}>
            {sectionIndex > 0 ? (
              <div aria-hidden="true" className="workspace-tool-dock__divider" />
            ) : null}
            {section.items.map((item) => (
              <DockButton
                active={item.panel === props.panel}
                badge={item.panel === 'inbox' ? props.inboxUnreadCount : undefined}
                icon={item.icon}
                key={item.panel}
                label={item.label}
                onClick={() => props.onPanel(toggleWorkspacePanel(props.panel, item.panel))}
                panel={item.panel}
                title={
                  item.panel === 'terminal'
                    ? `${item.label}（右侧栏）`
                    : item.shortcut
                      ? `${item.label} ${item.shortcut}`
                      : item.label
                }
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function DockButton(props: {
  readonly panel: Exclude<WorkspacePanel, 'none'>;
  readonly active: boolean;
  readonly icon: React.ComponentType<{ readonly size?: number; readonly className?: string }>;
  readonly label: string;
  readonly onClick: () => void;
  readonly title: string;
  readonly badge?: number;
}): ReactNode {
  const Icon = props.icon;
  const badgeLabel =
    props.badge === undefined
      ? undefined
      : props.badge > 99
        ? '99+'
        : String(props.badge);
  return (
    <button
      aria-label={
        badgeLabel === undefined ? props.label : `${props.label}，${badgeLabel} 条未读`
      }
      aria-pressed={props.active}
      className={props.active ? 'is-active' : ''}
      data-panel={props.panel}
      onClick={props.onClick}
      title={props.title}
      type="button"
    >
      <Icon aria-hidden size={17} />
      {badgeLabel === undefined ? null : (
        <em className="workspace-tool-dock__badge">{badgeLabel}</em>
      )}
      <span className="workspace-tool-dock__indicator" aria-hidden />
    </button>
  );
}
