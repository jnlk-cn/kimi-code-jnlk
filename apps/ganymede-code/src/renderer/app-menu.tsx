import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight } from 'lucide-react';

export interface AppMenuItem {
  readonly id: string;
  readonly label?: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly shortcut?: string;
  readonly checked?: boolean;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly separator?: boolean;
  readonly children?: readonly AppMenuItem[];
  readonly onSelect?: () => void;
}

export type MenuAnchor =
  | { readonly kind: 'rect'; readonly rect: DOMRect }
  | { readonly kind: 'point'; readonly x: number; readonly y: number };

export function anchorFromElement(element: HTMLElement): MenuAnchor {
  return { kind: 'rect', rect: element.getBoundingClientRect() };
}

export function AppMenuPopover(props: {
  readonly anchor: MenuAnchor;
  readonly items: readonly AppMenuItem[];
  readonly onClose: () => void;
  readonly placement?: 'top-start' | 'bottom-start' | 'bottom-end';
  readonly ariaLabel: string;
  readonly searchPlaceholder?: string;
}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });
  const [submenuDirection, setSubmenuDirection] = useState<'left' | 'right'>('right');
  const [query, setQuery] = useState('');
  const visibleItems = useMemo(
    () => props.searchPlaceholder === undefined || query.trim().length === 0
      ? props.items
      : menuSearchItems(props.items, query),
    [props.items, props.searchPlaceholder, query],
  );

  useLayoutEffect(() => {
    const menu = host.current;
    if (menu === null) return;
    const bounds = menu.getBoundingClientRect();
    const gap = 7;
    let left: number;
    let top: number;
    if (props.anchor.kind === 'point') {
      left = props.anchor.x;
      top = props.anchor.y;
    } else {
      const rect = props.anchor.rect;
      left = props.placement === 'bottom-end' ? rect.right - bounds.width : rect.left;
      top = props.placement === 'top-start' ? rect.top - bounds.height - gap : rect.bottom + gap;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8));
    setSubmenuDirection(left + bounds.width * 2 + 12 > window.innerWidth ? 'left' : 'right');
    setStyle({ left, top, opacity: 1 });
  }, [props.anchor, props.placement, visibleItems]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      if (event.target instanceof Node && host.current?.contains(event.target) !== true) {
        props.onClose();
      }
    };
    const onWindowBlur = (): void => props.onClose();
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [props.onClose]);

  return createPortal(
    <div className="app-menu-popover" ref={host} style={style}>
      {props.searchPlaceholder !== undefined ? (
        <input
          aria-label={props.searchPlaceholder}
          autoFocus
          className="app-menu-search"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') props.onClose();
            if (event.key === 'Enter') {
              const first = visibleItems.find((item) => !item.separator && !item.disabled);
              if (first?.children === undefined && first?.onSelect !== undefined) {
                event.preventDefault();
                first.onSelect();
                props.onClose();
              }
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              host.current?.querySelector<HTMLElement>('.app-menu-level')?.focus();
            }
          }}
          placeholder={props.searchPlaceholder}
          value={query}
        />
      ) : null}
      <MenuLevel
        items={visibleItems}
        ariaLabel={props.ariaLabel}
        autoFocus={props.searchPlaceholder === undefined}
        onClose={props.onClose}
        submenuDirection={submenuDirection}
      />
    </div>,
    document.body,
  );
}

function MenuLevel(props: {
  readonly items: readonly AppMenuItem[];
  readonly ariaLabel: string;
  readonly autoFocus?: boolean;
  readonly onClose: () => void;
  readonly submenuDirection: 'left' | 'right';
}): ReactNode {
  const selectable = props.items.filter((item) => !item.separator && !item.disabled);
  const [activeId, setActiveId] = useState(selectable[0]?.id);
  const [submenuId, setSubmenuId] = useState<string>();
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.autoFocus !== false) menu.current?.focus();
  }, [props.autoFocus]);

  useEffect(() => {
    if (!selectable.some((item) => item.id === activeId)) {
      setActiveId(selectable[0]?.id);
      setSubmenuId(undefined);
    }
  }, [activeId, props.items, selectable]);

  const move = (delta: number): void => {
    if (selectable.length === 0) return;
    const index = Math.max(0, selectable.findIndex((item) => item.id === activeId));
    const next = (index + delta + selectable.length) % selectable.length;
    setActiveId(selectable[next]?.id);
    setSubmenuId(undefined);
  };

  const activate = (item: AppMenuItem | undefined): void => {
    if (item === undefined || item.disabled) return;
    if (item.children !== undefined) {
      setSubmenuId(item.id);
      return;
    }
    item.onSelect?.();
    props.onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const active = props.items.find((item) => item.id === activeId);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'ArrowRight' && active?.children !== undefined) {
      event.preventDefault();
      setSubmenuId(active.id);
    } else if (event.key === 'ArrowLeft' && submenuId !== undefined) {
      event.preventDefault();
      setSubmenuId(undefined);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      props.onClose();
    }
  };

  return (
    <div
      aria-label={props.ariaLabel}
      className="app-menu-level"
      onKeyDown={onKeyDown}
      ref={menu}
      role="menu"
      tabIndex={-1}
    >
      {props.items.map((item, index) => {
        if (item.separator) return <div className="app-menu-separator" key={item.id} role="separator" />;
        const active = item.id === activeId;
        const submenuOpen = item.id === submenuId && item.children !== undefined;
        return (
          <div className="app-menu-item-wrap" key={item.id}>
            <button
              aria-checked={item.checked}
              className={`${active ? 'active ' : ''}${item.danger ? 'danger' : ''}`}
              disabled={item.disabled}
              onClick={() => activate(item)}
              onMouseEnter={() => {
                setActiveId(item.id);
                setSubmenuId(item.children === undefined ? undefined : item.id);
              }}
              role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
              type="button"
            >
              <span className="app-menu-check">{item.checked ? <Check size={13} /> : null}</span>
              <span className="app-menu-icon">{item.icon}</span>
              <span className="app-menu-copy">
                <span>{item.label}</span>
                {item.description !== undefined ? <small>{item.description}</small> : null}
              </span>
              {item.shortcut !== undefined ? <kbd>{item.shortcut}</kbd> : null}
              {item.children !== undefined ? <ChevronRight className="app-menu-chevron" size={13} /> : null}
            </button>
            {submenuOpen ? (
              <div
                className={`app-menu-submenu${props.submenuDirection === 'left' ? ' open-left' : ''}`}
                style={index >= props.items.length / 2 ? { bottom: -6 } : { top: -6 }}
              >
                <MenuLevel
                  ariaLabel={item.label ?? props.ariaLabel}
                  autoFocus
                  items={item.children ?? []}
                  onClose={props.onClose}
                  submenuDirection={props.submenuDirection}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function menuSearchItems(items: readonly AppMenuItem[], query: string): readonly AppMenuItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  const matched = items.filter((item) => {
    if (item.separator) return false;
    if (item.id === 'open-project') return true;
    return `${item.label ?? ''} ${item.description ?? ''}`.toLocaleLowerCase().includes(normalized);
  });
  const openProjectIndex = matched.findIndex((item) => item.id === 'open-project');
  if (openProjectIndex <= 0) return matched;
  return [
    ...matched.slice(0, openProjectIndex),
    { id: 'search-separator', separator: true },
    ...matched.slice(openProjectIndex),
  ];
}
