import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Check, ChevronDown, Circle, ListTodo, LoaderCircle } from 'lucide-react';

import {
  formatHiddenCounts,
  formatActiveTodoLabel,
  selectVisibleTodos,
  todoProgressSummary,
  type TodoItem,
  type TodoStatus,
} from '../todo-panel';

function StatusIcon(props: { readonly status: TodoStatus }): ReactNode {
  if (props.status === 'done') return <Check size={12} />;
  if (props.status === 'in_progress') return <LoaderCircle className="spin" size={12} />;
  return <Circle size={12} />;
}

export function ComposerTodoBar(props: {
  readonly todos: readonly TodoItem[];
  readonly fromPlan?: boolean;
  readonly onOpenPlan?: () => void;
}): ReactNode {
  const [panelOpen, setPanelOpen] = useState(false);
  const [listExpanded, setListExpanded] = useState(false);
  const hasOverflow = props.todos.length > 5;
  const activeLabel = formatActiveTodoLabel(props.todos);
  const visible = listExpanded
    ? { rows: props.todos, hidden: 0, hiddenCounts: { done: 0, in_progress: 0, pending: 0 } }
    : selectVisibleTodos(props.todos);

  const togglePanel = (): void => {
    setPanelOpen((value) => {
      if (value) setListExpanded(false);
      return !value;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 't') return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
      ) {
        event.preventDefault();
        if (!panelOpen) {
          setPanelOpen(true);
          return;
        }
        if (hasOverflow) {
          setListExpanded((value) => !value);
          return;
        }
        setListExpanded(false);
        setPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasOverflow, panelOpen]);

  return (
    <div className={`composer-todo-bar${panelOpen ? ' open' : ''}`}>
      <button
        type="button"
        className="composer-todo-header"
        aria-expanded={panelOpen}
        onClick={togglePanel}
      >
        <span className="composer-todo-header-main">
          <ListTodo size={14} />
          <strong>{props.fromPlan === true ? '计划待办' : '待办'}</strong>
          <span className="composer-todo-summary">{todoProgressSummary(props.todos)}</span>
          {!panelOpen && activeLabel.length > 0 ? (
            <span className="composer-todo-active" title={activeLabel}>
              <LoaderCircle className="spin" size={12} aria-hidden="true" />
              <span className="composer-todo-active-title">{activeLabel}</span>
            </span>
          ) : null}
        </span>
        <ChevronDown size={14} className={panelOpen ? 'open' : undefined} />
      </button>
      {panelOpen ? (
        <>
          {props.fromPlan === true && props.onOpenPlan !== undefined ? (
            <button type="button" className="composer-todo-plan-link" onClick={props.onOpenPlan}>
              在计划面板中查看
            </button>
          ) : null}
          <ul className="composer-todo-list">
            {visible.rows.map((todo, index) => (
              <li key={`${todo.title}:${String(index)}`} className={`composer-todo-row status-${todo.status}`}>
                <StatusIcon status={todo.status} />
                <span>{todo.title}</span>
              </li>
            ))}
          </ul>
          {visible.hidden > 0 ? (
            <button type="button" className="composer-todo-footer" onClick={() => setListExpanded(true)}>
              还有 {visible.hidden} 项
              {formatHiddenCounts(visible.hiddenCounts).length > 0
                ? `（${formatHiddenCounts(visible.hiddenCounts)}）`
                : ''}
              …
            </button>
          ) : null}
          {listExpanded && hasOverflow ? (
            <button type="button" className="composer-todo-footer" onClick={() => setListExpanded(false)}>
              共 {props.todos.length} 项 · 点击折叠
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
