import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export type DraggablePanelItem = {
  id: string;
  title: string;
  status?: string;
  hidden?: boolean;
  content: ReactNode;
};

export function normalizePanelOrder(saved: readonly string[], available: readonly string[]) {
  const allowed = new Set(available);
  const ordered = saved.filter((id, index) => allowed.has(id) && saved.indexOf(id) === index);
  for (const id of available) if (!ordered.includes(id)) ordered.push(id);
  return ordered;
}

export function reorderPanelIds(
  order: readonly string[],
  draggedId: string,
  targetId: string,
  placement: 'before' | 'after' = 'before',
) {
  if (draggedId === targetId || !order.includes(draggedId) || !order.includes(targetId)) return [...order];
  const next = order.filter((id) => id !== draggedId);
  const targetIndex = next.indexOf(targetId);
  next.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, draggedId);
  return next;
}

type PanelSize = { columns: number; height: number };
type DropTarget = { id: string; placement: 'before' | 'after' } | null;

const clampSize = (size: PanelSize): PanelSize => ({
  columns: Math.max(1, Math.min(4, Math.round(size.columns))),
  height: Math.max(140, Math.min(560, Math.round(size.height))),
});

function loadPanelSizes(storageKey: string) {
  if (typeof window === 'undefined') return {} as Record<string, PanelSize>;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${storageKey}.sizes`) || '{}') as Record<string, Partial<PanelSize>>;
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, value]) => {
      if (!value || typeof value.columns !== 'number' || typeof value.height !== 'number') return [];
      return [[id, clampSize({ columns: value.columns, height: value.height })]];
    })) as Record<string, PanelSize>;
  } catch {
    return {};
  }
}

function loadCollapsed(storageKey: string) {
  if (typeof window === 'undefined') return {} as Record<string, boolean>;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${storageKey}.collapsed`) || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'boolean')) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function loadOrder(storageKey: string, ids: readonly string[]) {
  if (typeof window === 'undefined') return [...ids];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    return normalizePanelOrder(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [], ids);
  } catch {
    return [...ids];
  }
}

export default function DraggablePanelDeck({
  items,
  storageKey,
  className = '',
}: {
  items: DraggablePanelItem[];
  storageKey: string;
  className?: string;
}) {
  const ids = items.map((item) => item.id);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const resizing = useRef<{
    id: string;
    startX: number;
    startY: number;
    startColumns: number;
    startHeight: number;
    columnWidth: number;
  } | null>(null);
  const latestSizes = useRef<Record<string, PanelSize>>({});
  const [order, setOrder] = useState(() => loadOrder(storageKey, ids));
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => loadCollapsed(storageKey));
  const [sizes, setSizes] = useState<Record<string, PanelSize>>(() => {
    const loaded = loadPanelSizes(storageKey);
    latestSizes.current = loaded;
    return loaded;
  });

  const normalized = useMemo(() => normalizePanelOrder(order, ids), [order, ids.join('|')]);
  const available = normalized
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is DraggablePanelItem => Boolean(item && !item.hidden));
  const collapsedItems = available.filter((item) => collapsed[item.id]);
  const expandedItems = available.filter((item) => !collapsed[item.id]);

  const persistOrder = (next: string[]) => {
    setOrder(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* layout still works */ }
  };
  const persistCollapsed = (next: Record<string, boolean>) => {
    setCollapsed(next);
    try { window.localStorage.setItem(`${storageKey}.collapsed`, JSON.stringify(next)); } catch { /* optional persistence */ }
  };
  const persistSizes = (next = latestSizes.current) => {
    try { window.localStorage.setItem(`${storageKey}.sizes`, JSON.stringify(next)); } catch { /* optional persistence */ }
  };
  const updateSize = (id: string, next: PanelSize, persist = false) => {
    const safe = clampSize(next);
    setSizes((current) => {
      const updated = { ...current, [id]: safe };
      latestSizes.current = updated;
      return updated;
    });
    if (persist) queueMicrotask(() => persistSizes());
  };
  const resetLayout = () => {
    persistOrder(ids);
    persistCollapsed({});
    latestSizes.current = {};
    setSizes({});
    persistSizes({});
  };

  const placementFor = (event: DragEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const horizontal = box.width >= box.height;
    const after = horizontal
      ? event.clientX >= box.left + box.width / 2
      : event.clientY >= box.top + box.height / 2;
    return after ? 'after' as const : 'before' as const;
  };

  const dropOn = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain') || dragging;
    if (!draggedId) return;
    persistOrder(reorderPanelIds(normalized, draggedId, targetId, placementFor(event)));
    setDragging(null);
    setDropTarget(null);
  };

  const resizeFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, id: string, size: PanelSize) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const next = { ...size };
    if (event.key === 'ArrowLeft') next.columns -= 1;
    if (event.key === 'ArrowRight') next.columns += 1;
    if (event.key === 'ArrowUp') next.height -= 30;
    if (event.key === 'ArrowDown') next.height += 30;
    updateSize(id, next, true);
  };

  return <section className={`draggable-panel-deck ${className}`}>
    <div className="draggable-panel-deck-toolbar">
      <span>PANEL LAYOUT</span>
      <small>Drag headers · resize corners · collapse to free space</small>
      <button onClick={resetLayout}>RESET LAYOUT</button>
    </div>

    {collapsedItems.length > 0 && <div className="collapsed-panel-shelf" aria-label="Collapsed Programmer panels">
      <span>COLLAPSED</span>
      {collapsedItems.map((item) => <button
        key={item.id}
        data-collapsed-panel={item.id}
        onClick={() => persistCollapsed({ ...collapsed, [item.id]: false })}
        title={`Restore ${item.title}`}
      >
        <b>▸</b><strong>{item.title}</strong>{item.status && <small>{item.status}</small>}
      </button>)}
    </div>}

    <div className="draggable-panel-grid" ref={gridRef}>
      {expandedItems.map((item) => {
        const size = sizes[item.id] ?? { columns: 1, height: 180 };
        const target = dropTarget?.id === item.id ? dropTarget.placement : null;
        return <article
          key={item.id}
          className={[
            'draggable-programmer-panel',
            dragging === item.id ? 'dragging' : '',
            target ? `drop-${target}` : '',
          ].filter(Boolean).join(' ')}
          data-panel-id={item.id}
          style={{
            '--panel-columns': size.columns,
            '--panel-height': `${size.height}px`,
          } as CSSProperties}
          onDragOver={(event) => {
            if (!dragging || dragging === item.id) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDropTarget({ id: item.id, placement: placementFor(event) });
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
          }}
          onDrop={(event) => dropOn(event, item.id)}
        >
          <header className="draggable-programmer-panel-handle">
            <button
              className="panel-drag-grip"
              draggable
              aria-label={`Move ${item.title} panel`}
              title={`Drag ${item.title}`}
              onDragStart={(event) => {
                setDragging(item.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', item.id);
              }}
              onDragEnd={() => {
                setDragging(null);
                setDropTarget(null);
              }}
            >⠿</button>
            <div><strong>{item.title}</strong>{item.status && <small>{item.status}</small>}</div>
            <button
              className="panel-collapse-toggle"
              aria-label={`Collapse ${item.title}`}
              title={`Collapse ${item.title}`}
              onClick={() => persistCollapsed({ ...collapsed, [item.id]: true })}
            >▾</button>
          </header>
          <div className="draggable-programmer-panel-body">{item.content}</div>
          <button
            className="panel-resize-handle"
            aria-label={`Resize ${item.title} panel`}
            title={`Resize ${item.title} · double-click to reset`}
            onDoubleClick={() => {
              const next = { ...latestSizes.current };
              delete next[item.id];
              latestSizes.current = next;
              setSizes(next);
              persistSizes(next);
            }}
            onKeyDown={(event) => resizeFromKeyboard(event, item.id, size)}
            onPointerDown={(event) => {
              event.preventDefault();
              const panel = event.currentTarget.closest<HTMLElement>('.draggable-programmer-panel');
              const grid = gridRef.current;
              if (!panel || !grid) return;
              const panelBox = panel.getBoundingClientRect();
              const gridBox = grid.getBoundingClientRect();
              resizing.current = {
                id: item.id,
                startX: event.clientX,
                startY: event.clientY,
                startColumns: size.columns,
                startHeight: size.height,
                columnWidth: Math.max(150, panelBox.width / size.columns, gridBox.width / 5),
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const active = resizing.current;
              if (!active || active.id !== item.id) return;
              updateSize(item.id, {
                columns: active.startColumns + (event.clientX - active.startX) / active.columnWidth,
                height: active.startHeight + event.clientY - active.startY,
              });
            }}
            onPointerUp={(event) => {
              if (resizing.current?.id === item.id) {
                resizing.current = null;
                persistSizes();
              }
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={(event) => {
              if (resizing.current?.id === item.id) {
                resizing.current = null;
                persistSizes();
              }
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          >↘</button>
        </article>;
      })}
    </div>
  </section>;
}
