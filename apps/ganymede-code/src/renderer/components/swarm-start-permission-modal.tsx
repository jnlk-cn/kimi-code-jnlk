import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

export type SwarmStartPermissionChoice = 'auto' | 'yolo' | 'manual';

export function SwarmStartPermissionModal(props: {
  readonly onSelect: (choice: SwarmStartPermissionChoice) => void;
  readonly onCancel: () => void;
}): ReactNode {
  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onCancel}>
      <div
        className="modal swarm-permission-modal"
        role="dialog"
        aria-labelledby="swarm-permission-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="approval-title">
          <span><ShieldAlert size={18} /></span>
          <div>
            <strong id="swarm-permission-title">在「手动」批准模式下启动集群任务？</strong>
            <p>手动批准可能在子 Agent 并行运行时反复打断进度。</p>
          </div>
        </div>
        <ul className="swarm-permission-notices">
          <li>「手动」模式会在命令、改文件等风险操作前询问你。</li>
          <li>集群任务期间频繁审批可能阻塞并行子 Agent。</li>
          <li>取消后会保留你输入的命令，不会丢失。</li>
        </ul>
        <div className="modal-actions column">
          <button
            className="primary-button"
            type="button"
            onClick={() => props.onSelect('auto')}
          >
            <strong>切换到 Auto 并开始</strong>
            <small>适合集群任务。自动执行所有操作（含高风险），不再向你提问。</small>
          </button>
          <button type="button" onClick={() => props.onSelect('yolo')}>
            <strong>切换到 YOLO 并开始</strong>
            <small>工具与计划变更由 AI 自动判断；仍可能向你提问。</small>
          </button>
          <button type="button" onClick={() => props.onSelect('manual')}>
            <strong>保持手动并开始</strong>
            <small>继续逐项审批；集群过程中可能多次暂停等待你。</small>
          </button>
          <button className="ghost" type="button" onClick={props.onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
