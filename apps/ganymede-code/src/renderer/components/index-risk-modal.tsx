import type { ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

import type { IndexRiskAssessment } from '../../shared/contracts';

export function IndexRiskModal(props: {
  readonly assessment: IndexRiskAssessment;
  readonly onCancel: () => void;
  readonly onForceIndex: () => void;
  readonly onOptOut: () => void;
  readonly onDisableIndex: () => void;
}): ReactNode {
  const title =
    props.assessment.kind === 'home' ? '不建议索引此目录' : '目录规模较大，确认索引？';

  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onCancel}>
      <div
        aria-labelledby="index-risk-title"
        className="modal index-risk-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <strong id="index-risk-title">
            <AlertTriangle size={16} />
            {title}
          </strong>
          <button aria-label="关闭" onClick={props.onCancel} title="关闭" type="button">
            <X size={16} />
          </button>
        </header>
        <div className="modal-body">
          <p>{props.assessment.message}</p>
          <div className="modal-actions column">
            <button className="primary-button" onClick={props.onForceIndex} type="button">
              仍然索引
              <small>我了解风险，继续建立本地索引</small>
            </button>
            <button onClick={props.onOptOut} type="button">
              不再索引此目录
              <small>记住选择，之后打开时跳过</small>
            </button>
            <button className="danger-button" onClick={props.onDisableIndex} type="button">
              关闭索引功能
              <small>在设置中关闭全局项目索引</small>
            </button>
            <button onClick={props.onCancel} type="button">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
