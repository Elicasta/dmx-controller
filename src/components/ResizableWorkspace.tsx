import { Children, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type SavedLayout = {
  left: number;
  right: number;
  hideLeft: boolean;
  hideRight: boolean;
};

const DEFAULT_LEFT = 220;
const DEFAULT_RIGHT = 280;

function loadLayout(key: string): SavedLayout {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<SavedLayout> | null;
    return {
      left: Number.isFinite(value?.left) ? Math.max(140, Number(value?.left)) : DEFAULT_LEFT,
      right: Number.isFinite(value?.right) ? Math.max(150, Number(value?.right)) : DEFAULT_RIGHT,
      hideLeft: Boolean(value?.hideLeft),
      hideRight: Boolean(value?.hideRight)
    };
  } catch {
    return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT, hideLeft: false, hideRight: false };
  }
}

export default function ResizableWorkspace({
  children,
  className,
  storageKey = 'lumarig.workspace-panels.v2',
  leftLabel = 'Fixtures',
  rightLabel = 'Inspector'
}: {
  children: ReactNode;
  className: string;
  storageKey?: string;
  leftLabel?: string;
  rightLabel?: string;
}) {
  const initial = useMemo(() => loadLayout(storageKey), [storageKey]);
  const ref = useRef<HTMLElement | null>(null);
  const [left, setLeft] = useState(initial.left);
  const [right, setRight] = useState(initial.right);
  const [hideLeft, setHideLeft] = useState(initial.hideLeft);
  const [hideRight, setHideRight] = useState(initial.hideRight);
  const [compact, setCompact] = useState(false);
  const drag = useRef<'left' | 'right' | null>(null);
  const hasRight = Children.toArray(children).length > 2;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ left, right, hideLeft, hideRight }));
  }, [storageKey, left, right, hideLeft, hideRight]);

  useEffect(() => {
    const node = ref.current;
    if (!node || !('ResizeObserver' in window)) return;
    const observer = new ResizeObserver(([entry]) => {
      setCompact(entry.contentRect.width < 760);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function move(clientX: number) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const reserve = 320;
    const maxLeft = Math.max(160, Math.min(box.width * .4, box.width - reserve));
    const maxRight = Math.max(170, Math.min(box.width * .4, box.width - reserve));
    if (drag.current === 'left') setLeft(Math.max(140, Math.min(maxLeft, clientX - box.left)));
    if (drag.current === 'right') setRight(Math.max(150, Math.min(maxRight, box.right - clientX)));
  }

  function reset(side: 'left' | 'right') {
    if (side === 'left') {
      setLeft(DEFAULT_LEFT);
      setHideLeft(false);
    } else {
      setRight(DEFAULT_RIGHT);
      setHideRight(false);
    }
  }

  function divider(side: 'left' | 'right', value: number) {
    return <div
      className={'workspace-divider divider-' + side}
      role="separator"
      aria-label={'Resize ' + side + ' panel'}
      aria-orientation="vertical"
      aria-valuemin={side === 'left' ? 140 : 150}
      aria-valuemax={Math.round((ref.current?.clientWidth ?? 1000) * .4)}
      aria-valuenow={value}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      style={side === 'left' ? { left: value + 4 } : { right: value + 4 }}
      onDoubleClick={() => reset(side)}
      onPointerDown={(event) => {
        event.preventDefault();
        drag.current = side;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (drag.current === side) move(event.clientX);
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') return reset(side);
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 12 : -12;
        if (side === 'left') setLeft((current) => Math.max(140, current + delta));
        else setRight((current) => Math.max(150, current - delta));
      }}
    />;
  }

  const effectiveHideLeft = compact ? true : hideLeft;
  const effectiveHideRight = compact && hasRight ? true : hideRight;
  const columns = (effectiveHideLeft ? '' : left + 'px ') + 'minmax(0,1fr)' + (hasRight && !effectiveHideRight ? ' ' + right + 'px' : '');

  return <section
    ref={ref}
    className={className + ' resizable-workspace' + (effectiveHideLeft ? ' left-collapsed' : '') + (effectiveHideRight ? ' right-collapsed' : '') + (compact ? ' workspace-compact' : '')}
    style={{ '--workspace-columns': columns } as CSSProperties}
  >
    <div className="workspace-panel-tools">
      <button title={(effectiveHideLeft ? 'Show ' : 'Collapse ') + leftLabel} onClick={() => setHideLeft(!hideLeft)}>
        <span className="workspace-tool-full">{effectiveHideLeft ? 'Show' : 'Collapse'} {leftLabel}</span>
        <span className="workspace-tool-icon">{effectiveHideLeft ? '›' : '‹'}</span>
      </button>
      {hasRight && <button title={(effectiveHideRight ? 'Show ' : 'Collapse ') + rightLabel} onClick={() => setHideRight(!hideRight)}>
        <span className="workspace-tool-full">{effectiveHideRight ? 'Show' : 'Collapse'} {rightLabel}</span>
        <span className="workspace-tool-icon">{effectiveHideRight ? '‹' : '›'}</span>
      </button>}
    </div>
    {children}
    {!effectiveHideLeft && divider('left', left)}
    {hasRight && !effectiveHideRight && divider('right', right)}
  </section>;
}
