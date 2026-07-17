import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { TerminalSquare } from 'lucide-react';

import type {
  DeepSeekBillingSnapshot,
  GitStatus,
  ModelOption,
  ProjectSummary,
  SessionSnapshot,
} from '../../shared/contracts';
import {
  indexBadgeLabel,
  indexStatusTitle,
  useProjectIndexStatus,
} from '../project-index-status';
import {
  billingSnapshotToTelemetry,
  buildTelemetrySegments,
  FOOTER_TELEMETRY_SEPARATOR,
  joinTelemetrySegments,
  type FooterTelemetrySegment,
} from '../footer-telemetry';
import { interactionModeClassName } from '../composer-mode-ui';
import {
  footerInteractionModeLabel,
  footerModelLabel,
  footerPermissionBadges,
  formatFooterContextStatus,
  formatFooterGitBadge,
  shortenFooterWorkDir,
} from '../footer-status';
import { TERMINAL_PANEL_META } from './workspace-panels';

const api = window.ganymede;
const BILLING_POLL_MS = 30_000;

export function WorkspaceBottomBar(props: {
  readonly project?: ProjectSummary;
  readonly session?: SessionSnapshot;
  readonly models: readonly ModelOption[];
  readonly terminalOpen: boolean;
  readonly onToggleTerminal: () => void;
}): ReactNode {
  const [gitStatus, setGitStatus] = useState<GitStatus>();
  const [billing, setBilling] = useState<DeepSeekBillingSnapshot>();
  const indexStatus = useProjectIndexStatus(props.project?.workDir);

  useEffect(() => {
    let alive = true;
    setGitStatus(undefined);
    if (props.project === undefined || !props.project.isGitRepository) {
      return () => {
        alive = false;
      };
    }
    void api
      .gitStatus(props.project.workDir)
      .then((status) => {
        if (alive) setGitStatus(status);
      })
      .catch(() => {
        if (alive) setGitStatus(undefined);
      });
    return () => {
      alive = false;
    };
  }, [props.project?.workDir, props.project?.isGitRepository, props.project?.updatedAt]);

  const refreshBilling = useCallback(
    (refreshBalance = false) => {
      if (props.session === undefined) {
        setBilling(undefined);
        return;
      }
      void api
        .deepSeekBillingSnapshot({
          sessionId: props.session.id,
          refreshBalance,
        })
        .then(setBilling)
        .catch(() => {
          setBilling(undefined);
        });
    },
    [props.session?.id],
  );

  useEffect(() => {
    refreshBilling(true);
    if (props.session === undefined) return;
    const timer = window.setInterval(() => refreshBilling(false), BILLING_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshBilling, props.session?.id]);

  useEffect(() => {
    if (props.session === undefined) return;
    refreshBilling(false);
  }, [props.session?.liveEvents.length, props.session?.status.running, refreshBilling]);

  const pathLabel =
    props.project === undefined ? '未选择项目' : shortenFooterWorkDir(props.project.workDir);
  const gitBadge = gitStatus === undefined ? null : formatFooterGitBadge(gitStatus);
  const status = props.session?.status;
  const permissionBadges = status === undefined ? [] : footerPermissionBadges(status.permission);
  const interactionMode = status?.interactionMode;
  const interactionLabel =
    interactionMode === undefined ? null : footerInteractionModeLabel(interactionMode);
  const modelLabel =
    status === undefined ? null : footerModelLabel(status.model, status.thinkingEffort, props.models);
  const contextText =
    status === undefined
      ? null
      : formatFooterContextStatus(status.contextTokens, status.maxContextTokens);
  const telemetrySegments =
    billing === undefined ? [] : buildTelemetrySegments(billingSnapshotToTelemetry(billing));
  const indexLabel = indexBadgeLabel(indexStatus);
  const indexBadgeInactive =
    indexStatus?.state === 'idle' ||
    indexStatus?.state === 'disabled' ||
    indexStatus === undefined;

  return (
    <footer className="workspace-bottom-bar">
      <div className="workspace-bottom-main">
        <div className="workspace-bottom-line workspace-bottom-line-primary">
          {permissionBadges.map((badge) => (
            <span key={badge} className="workspace-bottom-badge permission">
              {badge}
            </span>
          ))}
          {interactionLabel !== null && interactionMode !== undefined ? (
            <span className={`workspace-bottom-badge mode ${interactionModeClassName(interactionMode)}`}>
              {interactionLabel}
            </span>
          ) : null}
          {modelLabel !== null ? (
            <span className="workspace-bottom-model">{modelLabel}</span>
          ) : null}
          <span className="workspace-bottom-path" title={props.project?.workDir}>
            {pathLabel}
          </span>
          {gitBadge !== null ? (
            <span className={`workspace-bottom-git${gitStatus?.clean === true ? ' clean' : ' dirty'}`}>
              {gitBadge}
            </span>
          ) : null}
          {indexLabel.length > 0 ? (
            <span
              className={`workspace-bottom-badge index${indexBadgeInactive ? ' inactive' : ''}`}
              title={indexStatusTitle(indexStatus)}
            >
              {indexLabel}
            </span>
          ) : null}
        </div>
        {contextText !== null || telemetrySegments.length > 0 ? (
          <FooterSecondaryLine contextText={contextText} segments={telemetrySegments} />
        ) : null}
      </div>
      <button
        type="button"
        className={`workspace-bottom-terminal${props.terminalOpen ? ' active' : ''}`}
        aria-label={TERMINAL_PANEL_META.label}
        aria-pressed={props.terminalOpen}
        title={`${TERMINAL_PANEL_META.label} ${TERMINAL_PANEL_META.shortcut}`}
        onClick={props.onToggleTerminal}
      >
        <TerminalSquare size={14} />
        <span>{TERMINAL_PANEL_META.shortLabel}</span>
        <kbd>{TERMINAL_PANEL_META.shortcut}</kbd>
      </button>
    </footer>
  );
}

function FooterSecondaryLine(props: {
  readonly contextText: string | null;
  readonly segments: readonly FooterTelemetrySegment[];
}): ReactNode {
  const lineRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLSpanElement>(null);
  const [visibleSegments, setVisibleSegments] = useState<readonly FooterTelemetrySegment[]>([]);

  useLayoutEffect(() => {
    const line = lineRef.current;
    const context = contextRef.current;
    if (line === null) return;

    const measure = (): void => {
      const contextWidth = context?.offsetWidth ?? 0;
      const gap = props.contextText !== null && props.segments.length > 0 ? 8 : 0;
      const budgetPx = Math.max(0, line.clientWidth - contextWidth - gap);
      const charBudget = Math.max(0, Math.floor(budgetPx / 6.5));
      setVisibleSegments(joinTelemetrySegments(props.segments, charBudget));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(line);
    if (context !== null) observer.observe(context);
    return () => observer.disconnect();
  }, [props.contextText, props.segments]);

  if (props.contextText === null && visibleSegments.length === 0) return null;

  return (
    <div ref={lineRef} className="workspace-bottom-line workspace-bottom-line-secondary">
      {visibleSegments.length > 0 ? (
        <span className="workspace-bottom-telemetry">
          {visibleSegments.map((segment, index) => (
            <span key={`${segment.priority}:${segment.text}`}>
              {index > 0 ? FOOTER_TELEMETRY_SEPARATOR : null}
              <span className={`workspace-bottom-telemetry-seg tone-${segment.tone}`}>
                {segment.text}
              </span>
            </span>
          ))}
        </span>
      ) : (
        <span className="workspace-bottom-telemetry" />
      )}
      {props.contextText !== null ? (
        <span ref={contextRef} className="workspace-bottom-context">
          {props.contextText}
        </span>
      ) : null}
    </div>
  );
}
