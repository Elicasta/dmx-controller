import { useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';

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

function loadPanelSizes(storageKey: string) {
  if (typeof window === 'undefined') return {} as Record<string, PanelSize>;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${storageKey}.sizes`) || '{}') as Record<string, Partial<PanelSize>>;
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, value]) => {
      if (!value || typeof value.columns !== 'number' || typeof value.height !== 'number') return [];
      return [[id, {
        columns: Math.max(1, Math.min(3, Math.round(value.columns))),
        height: Math.max(150, Math.min(520, Math.round(value.height))),
      }]];
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
  const [order, setOrder] = useState(() => loadOrder(storageKey, ids));
  const [dragging, setDragging] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => loadCollapsed(storageKey));
  const [sizes, setSizes] = useState<Record<string, PanelSize>>(() => loadPanelSizes(storageKey));

  const normalized = useMemo(() => normalizePanelOrder(order, ids), [order, ids.join('|')]);
  const visible = normalized
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is DraggablePanelItem => Boolean(item && !item.hidden));

  const save = (next: string[]) => {
    setOrder(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* layout still works without persistence */ }
  };
  const saveCollapsed = (next: Record<string, boolean>) => {
    setCollapsed(next);
    try { window.localStorage.setItem(`${storageKey}.collapsed`, JSON.stringify(next)); } catch { /* optional persistence */ }
  };
  const saveSizes = (next: Record<string, PanelSize>) => {
    setSizes(next);
    try { window.localStorage.setItem(`${storageKey}.sizes`, JSON.stringify(next)); } catch { /* optional persistence */ }
  };
  const resetLayout = () => {
    save(ids);
    saveCollapsed({});
    saveSizes({});
  };

  const dropOn = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain') || dragging;
    if (!draggedId) return;
    const box = event.currentTarget.getBoundingClientRect();
    const horizontal = box.width >= box.height;
    const after = horizontal
      ? event.clientX >= box.left + box.width / 2
      : event.clientY >= box.top + box.height / 2;
    save(reorderPanelIds(normalized, draggedId, targetId, after ? 'after' : 'before'));
    setDragging(null);
  };

  return <section className={`draggable-panel-deck ${className}`}>
    <div className="draggable-panel-deck-toolbar">
      <span>PANEL LAYOUT</span>
      <small>Drag any panel by its handle</small>
      <button onClick={resetLayout}>RESET</button>
    </div>
    <div className="draggable-panel-grid" ref={gridRef}>
      {visible.map((item) => {
        const isCollapsed = Boolean(collapsed[item.id]);
        const size = sizes[item.id] ?? { columns: 1, height: 180 };
        return <article
          key={item.id}
          className={`draggable-programmer-panel ${dragging === item.id ? 'dragging' : ''} ${isCollapsed ? 'collapsed' : ''}`}
          data-panel-id={item.id}
          style={{
            '--panel-columns': size.columns,
            '--panel-height': `${size.height}px`,
          } as CSSProperties}
          onDragOver={(event) => {
            if (!dragging || dragging === item.id) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
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
              onDragEnd={() => setDragging(null)}
            >⠿</button>
            <div><strong>{item.title}</strong>{item.status && <small>{item.status}</small>}</div>
            <button
              className="panel-collapse-toggle"
              aria-label={isCollapsed ? `Expand ${item.title}` : `Collapse ${item.title}`}
              onClick={() => saveCollapsed({ ...collapsed, [item.id]: !collapsed[item.id] })}
            >{isCollapsed ? '▸' : '▾'}</button>
          </header>
          {!isCollapsed && <>
            <div className="draggable-programmer-panel-body">{item.content}</div>
            <button
              className="panel-resize-handle"
              aria-label={`Resize ${item.title} panel`}
              title={`Resize ${item.title}`}
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
                  columnWidth: Math.max(180, panelBox.width / size.columns, gridBox.width / 4),
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const active = resizing.current;
                if (!active || active.id !== item.id) return;
                const columns = Math.max(1, Math.min(3, Math.round(active.startColumns + (event.clientX - active.startX) / active.columnWidth)));
                const height = Math.max(150, Math.min(520, Math.round(active.startHeight + event.clientY - active.startY)));
                saveSizes({ ...sizes, [item.id]: { columns, height } });
              }}
              onPointerUp={(event) => {
                if (resizing.current?.id === item.id) resizing.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={(event) => {
                if (resizing.current?.id === item.id) resizing.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              }}
            >↘</button>
          </>}
        </article>;
      })}
    </div>
  </section>;
}
