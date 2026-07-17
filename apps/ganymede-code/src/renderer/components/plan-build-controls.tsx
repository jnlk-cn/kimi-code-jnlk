import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import type {
  ApprovalResolution,
  ModelOption,
  PendingApproval,
} from '../../shared/contracts';
import {
  AppMenuPopover,
  anchorFromElement,
  type AppMenuItem,
  type MenuAnchor,
} from '../app-menu';
import {
  buildShortcutLabel,
  modelMenuItems,
  modelShortLabel,
  type ModelConfigureInput,
} from '../model-menu';
import { modelProviderIcon } from '../model-provider-icon';
import {
  buildPlanReviewChoices,
  parsePlanReviewDisplay,
  type PlanReviewChoice,
} from '../plan-review';

const buildShortcutListeners = new Set<() => void>();
let buildShortcutBound = false;

function onBuildShortcutKeyDown(event: KeyboardEvent): void {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod || event.key !== 'Enter' || event.shiftKey || event.altKey) return;
  if (buildShortcutListeners.size === 0) return;
  event.preventDefault();
  // Prefer a single handler — all listeners share the same approval resolve path.
  const first = buildShortcutListeners.values().next().value;
  first?.();
}

function subscribeBuildShortcut(handler: () => void): () => void {
  buildShortcutListeners.add(handler);
  if (!buildShortcutBound) {
    window.addEventListener('keydown', onBuildShortcutKeyDown);
    buildShortcutBound = true;
  }
  return () => {
    buildShortcutListeners.delete(handler);
    if (buildShortcutListeners.size === 0 && buildShortcutBound) {
      window.removeEventListener('keydown', onBuildShortcutKeyDown);
      buildShortcutBound = false;
    }
  };
}

export function PlanBuildControls(props: {
  readonly request: PendingApproval;
  readonly models: readonly ModelOption[];
  readonly model?: string;
  readonly thinking?: string;
  readonly platform?: NodeJS.Platform;
  readonly variant?: 'inline' | 'dock';
  readonly onConfigureModel: (config: ModelConfigureInput) => void;
  readonly onResolve: (resolution: ApprovalResolution) => void;
}): ReactNode {
  const variant = props.variant ?? 'inline';
  const [modelMenuAnchor, setModelMenuAnchor] = useState<MenuAnchor>();
  const [buildMenuAnchor, setBuildMenuAnchor] = useState<MenuAnchor>();
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [feedback, setFeedback] = useState('');

  const display = parsePlanReviewDisplay(props.request.display);
  const choices = buildPlanReviewChoices(display);
  const approveChoices = choices.filter((choice) => choice.response === 'approved');
  const rejectChoice = choices.find((choice) => choice.selectedLabel === 'Reject');
  const reviseChoice = choices.find((choice) => choice.selectedLabel === 'Revise');
  const defaultApprove = approveChoices[0];

  // Do not gate on `running`: ExitPlanMode approvals arrive mid-turn, so the
  // session is still running while the user needs to click Build.
  const disabled = props.models.length === 0 || defaultApprove === undefined;
  const shortcut = buildShortcutLabel(props.platform);
  const modelItems = useMemo(
    () => modelMenuItems(props.model, props.thinking, props.models, props.onConfigureModel),
    [props.model, props.thinking, props.models, props.onConfigureModel],
  );

  function resolve(choice: PlanReviewChoice, feedbackText?: string): void {
    props.onResolve({
      id: props.request.id,
      decision: choice.response,
      scope: choice.response === 'approved' ? 'once' : undefined,
      selectedLabel: choice.selectedLabel,
      feedback: feedbackText !== undefined && feedbackText.length > 0 ? feedbackText : undefined,
    });
  }

  function approve(choice: PlanReviewChoice = defaultApprove!): void {
    if (disabled) return;
    resolve(choice);
  }

  const approveDefaultRef = useRef<() => void>(() => undefined);
  approveDefaultRef.current = () => {
    if (disabled || defaultApprove === undefined) return;
    resolve(defaultApprove);
  };

  useEffect(() => {
    if (disabled) return;
    return subscribeBuildShortcut(() => approveDefaultRef.current());
  }, [disabled, props.request.id]);

  const buildMenuItems = useMemo((): readonly AppMenuItem[] => {
    const items: AppMenuItem[] = [];
    if (approveChoices.length >= 2) {
      for (const choice of approveChoices) {
        items.push({
          id: `approve:${choice.selectedLabel}`,
          label: choice.label,
          description: choice.description,
          onSelect: () => approve(choice),
        });
      }
    } else if (defaultApprove !== undefined) {
      items.push({
        id: 'approve',
        label: '开始构建',
        description: '批准计划并退出计划模式',
        onSelect: () => approve(defaultApprove),
      });
    }
    if (items.length > 0) items.push({ id: 'sep-build', separator: true });
    if (reviseChoice !== undefined) {
      items.push({
        id: 'revise',
        label: '继续修订…',
        description: '保持计划模式，把反馈发给代理',
        onSelect: () => {
          setFeedbackMode(true);
          setFeedback('');
        },
      });
    }
    if (rejectChoice !== undefined) {
      items.push({
        id: 'reject',
        label: '拒绝计划',
        description: '保持计划模式，不开始构建',
        onSelect: () => resolve(rejectChoice),
      });
    }
    items.push({
      id: 'cancel',
      label: '取消',
      onSelect: () => props.onResolve({ id: props.request.id, decision: 'cancelled' }),
    });
    return items;
  }, [
    approveChoices,
    defaultApprove,
    rejectChoice,
    reviseChoice,
    props.request.id,
    props.onResolve,
    disabled,
  ]);

  if (feedbackMode) {
    return (
      <div className={`plan-build-controls ${variant} plan-build-feedback`}>
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="告诉代理需要如何修订计划…"
          rows={3}
          autoFocus
        />
        <div className="plan-build-feedback-actions">
          <button type="button" onClick={() => setFeedbackMode(false)}>
            返回
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={reviseChoice === undefined}
            onClick={() => {
              if (reviseChoice === undefined) return;
              resolve(reviseChoice, feedback.trim());
            }}
          >
            提交修订意见
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`plan-build-controls ${variant}`}
      role="group"
      aria-label="选择模型并开始构建"
    >
      {variant === 'dock' ? (
        <p className="plan-build-dock-hint">准备好按此计划开始构建了吗？</p>
      ) : null}
      <div className="plan-build-actions">
        <button
          type="button"
          className="plan-build-model"
          disabled={props.models.length === 0}
          title="选择用于构建的模型"
          aria-label="选择用于构建的模型"
          aria-expanded={modelMenuAnchor !== undefined}
          aria-haspopup="menu"
          onClick={(event) => {
            setBuildMenuAnchor(undefined);
            setModelMenuAnchor(anchorFromElement(event.currentTarget));
          }}
        >
          {modelProviderIcon(props.model, props.models, 13)}
          <span>{modelShortLabel(props.model, props.models)}</span>
          <ChevronDown size={11} />
        </button>
        <div className="plan-build-group">
          <button
            type="button"
            className="plan-build-main"
            disabled={disabled}
            title="开始构建"
            aria-label="开始构建"
            onClick={() => approve()}
          >
            <strong>Build</strong>
            <kbd>{shortcut}</kbd>
          </button>
          <button
            type="button"
            className="plan-build-toggle"
            disabled={disabled || buildMenuItems.length === 0}
            title="构建选项"
            aria-label="构建选项"
            aria-expanded={buildMenuAnchor !== undefined}
            aria-haspopup="menu"
            onClick={(event) => {
              setModelMenuAnchor(undefined);
              setBuildMenuAnchor(anchorFromElement(event.currentTarget));
            }}
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
      {modelMenuAnchor !== undefined ? (
        <AppMenuPopover
          anchor={modelMenuAnchor}
          ariaLabel="选择模型"
          items={modelItems}
          onClose={() => setModelMenuAnchor(undefined)}
          placement="bottom-start"
          searchPlaceholder="搜索模型或服务商"
        />
      ) : null}
      {buildMenuAnchor !== undefined ? (
        <AppMenuPopover
          anchor={buildMenuAnchor}
          ariaLabel="构建选项"
          items={buildMenuItems}
          onClose={() => setBuildMenuAnchor(undefined)}
          placement="bottom-end"
        />
      ) : null}
    </div>
  );
}
