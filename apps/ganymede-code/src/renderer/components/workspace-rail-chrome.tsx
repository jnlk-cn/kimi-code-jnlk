import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

export type WorkspaceRailHeaderMode = 'default' | 'tabs';

export interface WorkspaceRailHeaderSlot {
  readonly node: ReactNode;
  readonly mode: WorkspaceRailHeaderMode;
}

interface WorkspaceRailChromeContextValue {
  readonly setHeader: (slot: WorkspaceRailHeaderSlot | undefined) => void;
}

const WorkspaceRailChromeContext = createContext<WorkspaceRailChromeContextValue | undefined>(
  undefined,
);

export function WorkspaceRailChromeProvider(props: {
  readonly children: ReactNode;
  readonly onHeader: (slot: WorkspaceRailHeaderSlot | undefined) => void;
}): ReactNode {
  const value = useMemo<WorkspaceRailChromeContextValue>(
    () => ({ setHeader: props.onHeader }),
    [props.onHeader],
  );
  return (
    <WorkspaceRailChromeContext.Provider value={value}>
      {props.children}
    </WorkspaceRailChromeContext.Provider>
  );
}

export function WorkspaceRailChromeSlot(props: {
  readonly children: ReactNode;
  readonly mode?: WorkspaceRailHeaderMode;
}): ReactNode {
  const context = useContext(WorkspaceRailChromeContext);
  const mode = props.mode ?? 'tabs';
  const lastSlotRef = useRef<WorkspaceRailHeaderSlot | undefined>(undefined);
  useEffect(() => {
    const next: WorkspaceRailHeaderSlot = { node: props.children, mode };
    const last = lastSlotRef.current;
    if (last !== undefined && last.node === next.node && last.mode === next.mode) return;
    lastSlotRef.current = next;
    context?.setHeader(next);
    return () => {
      lastSlotRef.current = undefined;
      context?.setHeader(undefined);
    };
  }, [context, mode, props.children]);
  return null;
}
