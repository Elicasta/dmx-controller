import { useMemo, useState, type DragEvent, type ReactNode } from 'react';

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

export function reorderPanelIds(order: readonly string[], draggedId: string, targetId: string) {
  if (draggedId === targetId || !order.includes(draggedId) || !order.includes(targetId)) return [...order];
  const next = order.filter((id) => id !== draggedId);
  const targetIndex = next.indexOf(targetId);
  next.splice(targetIndex, 0, draggedId);
  return next;
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
  const [order, setOrder] = useState(() => loadOrder(storageKey, ids));
  const [dragging, setDragging] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const normalized = useMemo(() => normalizePanelOrder(order, ids), [order, ids.join('|')]);
  const visible = normalized
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is DraggablePanelItem => Boolean(item && !item.hidden));

  const save = (next: string[]) => {
    setOrder(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* layout still works without persistence */ }
  };

  const dropOn = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    if (!dragging) return;
    save(reorderPanelIds(normalized, dragging, targetId));
    setDragging(null);
  };

  return <section className={`draggable-panel-deck ${className}`}>
    <div className="draggable-panel-deck-toolbar">
      <span>PANEL LAYOUT</span>
      <small>Drag any panel by its handle</small>
      <button onClick={() => save(ids)}>RESET</button>
    </div>
    <div className="draggable-panel-grid">
      {visible.map((item) => {
        const isCollapsed = Boolean(collapsed[item.id]);
        return <article
          key={item.id}
          className={`draggable-programmer-panel ${dragging === item.id ? 'dragging' : ''} ${isCollapsed ? 'collapsed' : ''}`}
          data-panel-id={item.id}
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
              onClick={() => setCollapsed((current) => ({ ...current, [item.id]: !current[item.id] }))}
            >{isCollapsed ? '▸' : '▾'}</button>
          </header>
          {!isCollapsed && <div className="draggable-programmer-panel-body">{item.content}</div>}
        </article>;
      })}
    </div>
  </section>;
}
