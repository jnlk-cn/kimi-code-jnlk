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
  const surfaces = useRef<Set<HTMLElement>>(new Set());
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });
  const [submenuDirection, setSubmenuDirection] = useState<'left' | 'right'>('right');
  const [query, setQuery] = useState('');
  const registerSurface = useMemo(() => (element: HTMLElement | null): void => {
    if (element !== null) surfaces.current.add(element);
  }, []);
  const unregisterSurface = useMemo(() => (element: HTMLElement | null): void => {
    if (element !== null) surfaces.current.delete(element);
  }, []);
  const visibleItems = useMemo(
    () => props.searchPlaceholder === undefined || query.trim().length === 0
      ? props.items
      : menuSearchItems(props.items, query),
    [props.items, props.searchPlaceholder, query],
  );
  const visibleItemCount = useMemo(
    () => visibleItems.filter((item) => !item.separator).length,
    [visibleItems],
  );

  useLayoutEffect(() => {
    const menu = host.current;
    if (menu === null) return;
    registerSurface(menu);
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
    return () => unregisterSurface(menu);
  }, [props.anchor, props.placement, query, visibleItemCount, registerSurface, unregisterSurface]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      if (!(event.target instanceof Node)) return;
      for (const surface of surfaces.current) {
        if (surface.contains(event.target)) return;
      }
      props.onClose();
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
              } else if (first?.onSelect !== undefined && first.children !== undefined) {
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
      <div className="app-menu-scroll">
        <MenuLevel
          items={visibleItems}
          ariaLabel={props.ariaLabel}
          autoFocus={props.searchPlaceholder === undefined}
          onClose={props.onClose}
          registerSurface={registerSurface}
          submenuDirection={submenuDirection}
          unregisterSurface={unregisterSurface}
        />
      </div>
    </div>,
    document.body,
  );
}

const SUBMENU_SWITCH_DELAY_MS = 180;

function SubmenuPanel(props: {
  readonly direction: 'left' | 'right';
  readonly anchor: DOMRect;
  readonly onMouseEnter: () => void;
  readonly registerSurface: (element: HTMLElement | null) => void;
  readonly unregisterSurface: (element: HTMLElement | null) => void;
  readonly children: ReactNode;
}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    const element = host.current;
    if (element === null) return;
    props.registerSurface(element);
    const bounds = element.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    let left = props.direction === 'left'
      ? props.anchor.left - bounds.width - gap
      : props.anchor.right + gap;
    let top = props.anchor.top;
    left = Math.max(margin, Math.min(left, window.innerWidth - bounds.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - bounds.height - margin));
    setStyle({ left, top, opacity: 1 });
    return () => props.unregisterSurface(element);
  }, [props.anchor, props.direction, props.registerSurface, props.unregisterSurface]);

  return createPortal(
    <div
      className={`app-menu-submenu${props.direction === 'left' ? ' open-left' : ''}`}
      onMouseEnter={props.onMouseEnter}
      ref={host}
      style={style}
    >
      {props.children}
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
  readonly registerSurface: (element: HTMLElement | null) => void;
  readonly unregisterSurface: (element: HTMLElement | null) => void;
}): ReactNode {
  const selectable = props.items.filter((item) => !item.separator && !item.disabled);
  const [activeId, setActiveId] = useState(selectable[0]?.id);
  const [submenuId, setSubmenuId] = useState<string>();
  const [submenuAnchor, setSubmenuAnchor] = useState<DOMRect>();
  const menu = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const submenuSwitchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearSubmenuSwitchTimer = (): void => {
    if (submenuSwitchTimer.current !== undefined) {
      clearTimeout(submenuSwitchTimer.current);
      submenuSwitchTimer.current = undefined;
    }
  };

  const measureItem = (itemId: string): DOMRect | undefined =>
    itemRefs.current.get(itemId)?.getBoundingClientRect();

  const openSubmenuForItem = (item: AppMenuItem, immediate = false): void => {
    setActiveId(item.id);
    if (item.children === undefined) {
      clearSubmenuSwitchTimer();
      setSubmenuId(undefined);
      setSubmenuAnchor(undefined);
      return;
    }
    const anchor = measureItem(item.id);
    if (submenuId === item.id) {
      if (anchor !== undefined) setSubmenuAnchor(anchor);
      return;
    }
    const open = (): void => {
      setSubmenuId(item.id);
      setSubmenuAnchor(anchor ?? measureItem(item.id));
      submenuSwitchTimer.current = undefined;
    };
    if (immediate || submenuId === undefined) {
      clearSubmenuSwitchTimer();
      open();
      return;
    }
    clearSubmenuSwitchTimer();
    submenuSwitchTimer.current = setTimeout(open, SUBMENU_SWITCH_DELAY_MS);
  };

  const lockSubmenu = (itemId: string): void => {
    clearSubmenuSwitchTimer();
    setActiveId(itemId);
    setSubmenuId(itemId);
    const anchor = measureItem(itemId);
    if (anchor !== undefined) setSubmenuAnchor(anchor);
  };

  useEffect(() => {
    if (props.autoFocus !== false) menu.current?.focus();
  }, [props.autoFocus]);

  useEffect(() => () => clearSubmenuSwitchTimer(), []);

  useEffect(() => {
    if (!selectable.some((item) => item.id === activeId)) {
      clearSubmenuSwitchTimer();
      setActiveId(selectable[0]?.id);
      setSubmenuId(undefined);
      setSubmenuAnchor(undefined);
    }
  }, [activeId, props.items, selectable]);

  const move = (delta: number): void => {
    if (selectable.length === 0) return;
    const index = Math.max(0, selectable.findIndex((item) => item.id === activeId));
    const next = (index + delta + selectable.length) % selectable.length;
    const nextItem = selectable[next];
    if (nextItem === undefined) return;
    clearSubmenuSwitchTimer();
    setActiveId(nextItem.id);
    setSubmenuId(undefined);
    setSubmenuAnchor(undefined);
  };

  const activate = (item: AppMenuItem | undefined): void => {
    if (item === undefined || item.disabled) return;
    if (item.children !== undefined) {
      if (item.onSelect !== undefined) {
        item.onSelect();
        props.onClose();
        return;
      }
      openSubmenuForItem(item, true);
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
      openSubmenuForItem(active, true);
    } else if (event.key === 'ArrowLeft' && submenuId !== undefined) {
      event.preventDefault();
      clearSubmenuSwitchTimer();
      setSubmenuId(undefined);
      setSubmenuAnchor(undefined);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      props.onClose();
    }
  };

  const openItem = props.items.find((item) => item.id === submenuId);
  const openChildren = openItem?.children;

  return (
    <div
      aria-label={props.ariaLabel}
      className="app-menu-level"
      onKeyDown={onKeyDown}
      ref={menu}
      role="menu"
      tabIndex={-1}
    >
      {props.items.map((item) => {
        if (item.separator) return <div className="app-menu-separator" key={item.id} role="separator" />;
        const active = item.id === activeId;
        return (
          <div className={`app-menu-item-wrap${item.id === submenuId ? ' submenu-open' : ''}`} key={item.id}>
            <button
              aria-checked={item.checked}
              className={`${active ? 'active ' : ''}${item.danger ? 'danger' : ''}`}
              disabled={item.disabled}
              onClick={() => activate(item)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => openSubmenuForItem(item)}
              ref={(element) => {
                if (element === null) itemRefs.current.delete(item.id);
                else itemRefs.current.set(item.id, element);
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
          </div>
        );
      })}
      {openChildren !== undefined && submenuAnchor !== undefined && openItem !== undefined ? (
        <SubmenuPanel
          anchor={submenuAnchor}
          direction={props.submenuDirection}
          onMouseEnter={() => lockSubmenu(openItem.id)}
          registerSurface={props.registerSurface}
          unregisterSurface={props.unregisterSurface}
        >
          <MenuLevel
            ariaLabel={openItem.label ?? props.ariaLabel}
            autoFocus={false}
            items={openChildren}
            onClose={props.onClose}
            registerSurface={props.registerSurface}
            submenuDirection={props.submenuDirection}
            unregisterSurface={props.unregisterSurface}
          />
        </SubmenuPanel>
      ) : null}
    </div>
  );
}

/** Action ids kept at the bottom of filtered search results (not dropped by query). */
const PINNED_MENU_ACTION_IDS = new Set([
  'open-project',
  'open-from-disk',
  'add-additional-dir',
]);

function menuSearchItems(items: readonly AppMenuItem[], query: string): readonly AppMenuItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length === 0) return items;

  const matched: AppMenuItem[] = [];
  for (const item of items) {
    if (item.separator) continue;
    if (PINNED_MENU_ACTION_IDS.has(item.id)) {
      matched.push(item);
      continue;
    }
    const parentText = `${item.label ?? ''} ${item.description ?? ''}`.toLocaleLowerCase();
    if (parentText.includes(normalized)) {
      matched.push(item);
      continue;
    }
    if (item.children === undefined) continue;
    for (const child of item.children) {
      if (child.separator || child.disabled) continue;
      const childText = `${item.label ?? ''} ${child.label ?? ''} ${child.description ?? ''}`.toLocaleLowerCase();
      if (!childText.includes(normalized) || child.onSelect === undefined) continue;
      matched.push({
        ...child,
        id: child.id,
        label: `${item.label ?? ''} · ${child.label ?? ''}`,
        description: child.description ?? item.description,
        icon: child.icon ?? item.icon,
        children: undefined,
      });
    }
  }

  const firstPinnedIndex = matched.findIndex((item) => PINNED_MENU_ACTION_IDS.has(item.id));
  if (firstPinnedIndex <= 0) return matched;
  return [
    ...matched.slice(0, firstPinnedIndex),
    { id: 'search-separator', separator: true },
    ...matched.slice(firstPinnedIndex),
  ];
}
