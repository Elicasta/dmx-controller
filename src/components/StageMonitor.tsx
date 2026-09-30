import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Visualizer3D, { type VisualizerSnapshot } from './Visualizer3D';

export type StageSnapshot = VisualizerSnapshot;

const CHANNEL = 'lumarig-stage-monitor-v1';

export function useStagePublisher(snapshot: StageSnapshot) {
  const current = useRef(snapshot);
  current.current = snapshot;
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const next = new BroadcastChannel(CHANNEL);
    channel.current = next;
    next.onmessage = (event) => {
      if (event.data?.type === 'ready') next.postMessage({ type: 'frame', snapshot: current.current });
    };
    return () => {
      next.close();
      channel.current = null;
    };
  }, []);

  useEffect(() => {
    channel.current?.postMessage({ type: 'frame', snapshot });
  }, [snapshot]);
}

export async function openStageWindow(): Promise<boolean> {
  if ('__TAURI_INTERNALS__' in window) {
    try {
      await invoke('open_stage_monitor');
      return true;
    } catch {
      return false;
    }
  }
  return Boolean(window.open(
    new URL('?stage-monitor=1', window.location.href).href,
    'lumarig-stage-monitor',
    'width=1280,height=800'
  ));
}

export default function StageMonitor({
  snapshot,
  floating = false,
  onClose
}: {
  snapshot?: StageSnapshot;
  floating?: boolean;
  onClose?: () => void;
}) {
  const [incoming, setIncoming] = useState<StageSnapshot | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState(() => ({
    x: Math.max(20, window.innerWidth - 680),
    y: Math.max(80, window.innerHeight - 500)
  }));
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (snapshot) return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => {
      if (event.data?.type === 'frame') setIncoming(event.data.snapshot);
    };
    channel.postMessage({ type: 'ready' });
    return () => channel.close();
  }, [Boolean(snapshot)]);

  const data = snapshot ?? incoming;

  return <section
    className={`stage-monitor ${floating ? 'floating-stage-monitor' : ''} ${collapsed ? 'collapsed' : ''}`}
    style={floating ? { left: position.x, top: position.y } : undefined}
  >
    <header
      onPointerDown={(event) => {
        if (!floating || (event.target as HTMLElement).closest('button')) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX - position.x, y: event.clientY - position.y };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - (event.currentTarget.parentElement?.getBoundingClientRect().width ?? 660), event.clientX - drag.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - (event.currentTarget.parentElement?.getBoundingClientRect().height ?? 450), event.clientY - drag.current.y))
        });
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    >
      <div>
        <strong>VISUALIZER · LIVE SHOW</strong>
        <small>{data ? `${data.patch.length} fixtures · ${data.elements.length} objects` : 'Waiting for show state'}</small>
      </div>
      <div>
        {floating && <>
          <button onClick={() => void openStageWindow().then((open) => { if (open) onClose?.(); })}>Pop out ↗</button>
          <button aria-label="Collapse visualizer" onClick={() => setCollapsed(!collapsed)}>{collapsed ? 'Expand' : 'Collapse'}</button>
        </>}
        {onClose && <button aria-label="Close visualizer" onClick={onClose}>×</button>}
      </div>
    </header>
    {!collapsed && (data
      ? <Visualizer3D snapshot={data} compact={floating}/>
      : <div className="visualizer-waiting"><strong>Waiting for LumaRig…</strong><span>Open a show in the main window and the visualizer will attach automatically.</span></div>)}
  </section>;
}
