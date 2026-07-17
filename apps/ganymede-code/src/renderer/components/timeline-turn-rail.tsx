import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { FileCode2 } from 'lucide-react';

import {
  formatTurnTitle,
  splitEditPath,
  turnAnchorId,
  type SessionTurn,
} from '../session-turns';

const FILE_CHIP_LIMIT = 2;

function TurnPopover(props: {
  readonly turn: SessionTurn;
  readonly anchor: DOMRect;
}): ReactNode {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    top: props.anchor.top,
    left: Math.max(8, props.anchor.left - 12),
    transform: 'translate(-100%, 0)',
    visibility: 'hidden',
  });

  useEffect(() => {
    const card = cardRef.current;
    if (card === null) return;
    const rect = card.getBoundingClientRect();
    const margin = 8;
    let top = props.anchor.top + props.anchor.height / 2 - rect.height / 2;
    top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));
    let left = props.anchor.left - 12;
    let transform = 'translate(-100%, 0)';
    if (left - rect.width < margin) {
      left = props.anchor.right + 12;
      transform = 'translate(0, 0)';
    }
    setStyle({
      top,
      left,
      transform,
      visibility: 'visible',
    });
  }, [props.anchor]);

  const overflow = Math.max(0, props.turn.fileEdits.length - FILE_CHIP_LIMIT);
  const chips = props.turn.fileEdits.slice(0, FILE_CHIP_LIMIT);

  return (
    <div ref={cardRef} className="timeline-turn-popover" style={style} role="tooltip">
      <strong className="timeline-turn-popover-title">
        {formatTurnTitle(props.turn.userMessage)}
      </strong>
      {props.turn.assistantSummary.length > 0 ? (
        <p className="timeline-turn-popover-summary">{props.turn.assistantSummary}</p>
      ) : null}
      {props.turn.fileEdits.length > 0 ? (
        <div className="timeline-turn-popover-files">
          {chips.map((edit) => (
            <span key={edit.path} className="timeline-turn-file-chip" title={edit.path}>
              <FileCode2 size={12} />
              {splitEditPath(edit.path).name}
            </span>
          ))}
          {overflow > 0 ? (
            <span className="timeline-turn-file-overflow">+{overflow}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TimelineTurnRail(props: {
  readonly turns: readonly SessionTurn[];
  readonly onScrollToTurn: (turnId: string) => void;
}): ReactNode {
  const listId = useId();
  const railRef = useRef<HTMLElement | null>(null);
  const hoveredButtonRef = useRef<HTMLButtonElement | null>(null);
  const [hovered, setHovered] = useState<{ turn: SessionTurn; anchor: DOMRect }>();

  useEffect(() => {
    if (hovered === undefined) return;
    const updateAnchor = () => {
      const button = hoveredButtonRef.current;
      if (button === null) return;
      setHovered((current) =>
        current === undefined
          ? undefined
          : { turn: current.turn, anchor: button.getBoundingClientRect() },
      );
    };
    const rail = railRef.current;
    window.addEventListener('resize', updateAnchor);
    rail?.addEventListener('scroll', updateAnchor, { passive: true });
    return () => {
      window.removeEventListener('resize', updateAnchor);
      rail?.removeEventListener('scroll', updateAnchor);
    };
  }, [hovered?.turn.id]);

  if (props.turns.length === 0) return null;

  const showPopover = (turn: SessionTurn, button: HTMLButtonElement) => {
    hoveredButtonRef.current = button;
    setHovered({ turn, anchor: button.getBoundingClientRect() });
  };

  const hidePopover = () => {
    hoveredButtonRef.current = null;
    setHovered(undefined);
  };

  const onButtonBlur = (event: FocusEvent<HTMLButtonElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && railRef.current?.contains(next)) return;
    hidePopover();
  };

  return (
    <nav ref={railRef} className="timeline-turn-rail" aria-label="会话回合目录">
      <ul className="timeline-turn-rail-list" id={listId}>
        {props.turns.map((turn) => {
          const isHovered = hovered?.turn.id === turn.id;
          return (
            <li
              key={turn.id}
              onMouseEnter={(event) => {
                const button = event.currentTarget.querySelector('button');
                if (button instanceof HTMLButtonElement) {
                  showPopover(turn, button);
                }
              }}
              onMouseLeave={hidePopover}
            >
              <button
                type="button"
                className="timeline-turn-rail-item"
                aria-label={formatTurnTitle(turn.userMessage)}
                aria-describedby={isHovered ? `${listId}-popover` : undefined}
                onFocus={(event) => showPopover(turn, event.currentTarget)}
                onBlur={onButtonBlur}
                onClick={() => props.onScrollToTurn(turn.id)}
              >
                <span className="timeline-turn-rail-marker" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {hovered !== undefined ? (
        <div id={`${listId}-popover`}>
          <TurnPopover turn={hovered.turn} anchor={hovered.anchor} />
        </div>
      ) : null}
    </nav>
  );
}

export { turnAnchorId };
