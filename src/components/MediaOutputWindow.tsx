import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { mediaObjectUrl } from '../lib/media-library';
import type { TransportSnapshot } from '../core/transport-engine';

const CHANNEL = 'lumarig-media-output-v1';

type OutputFrame = {
  assetId: string;
  transport: TransportSnapshot;
};

export function useMediaOutputPublisher(assetId: string, transport: TransportSnapshot) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const current = useRef<OutputFrame>({ assetId, transport });
  current.current = { assetId, transport };

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === 'ready') channel.postMessage({ type: 'frame', ...current.current });
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    channelRef.current?.postMessage({ type: 'frame', assetId, transport });
  }, [assetId, transport]);
}

export async function openMediaOutputWindow(assetId: string): Promise<boolean> {
  if (!assetId) return false;
  if ('__TAURI_INTERNALS__' in window) {
    try {
      await invoke('open_media_output', { assetId });
      return true;
    } catch {
      return false;
    }
  }
  return Boolean(window.open(
    new URL(`?media-output=${encodeURIComponent(assetId)}`, window.location.href).href,
    'lumarig-media-output',
    'width=1280,height=720'
  ));
}

export default function MediaOutputWindow() {
  const params = new URLSearchParams(window.location.search);
  const requestedAssetId = params.get('media-output') ?? '';
  const [assetId, setAssetId] = useState(requestedAssetId);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('Loading media…');
  const [transport, setTransport] = useState<TransportSnapshot | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => {
      if (event.data?.type !== 'frame') return;
      if (typeof event.data.assetId === 'string' && event.data.assetId) setAssetId(event.data.assetId);
      if (event.data.transport) setTransport(event.data.transport as TransportSnapshot);
    };
    channel.postMessage({ type: 'ready' });
    return () => channel.close();
  }, []);

  useEffect(() => {
    if (!assetId) {
      setStatus('No media selected');
      return;
    }
    let disposed = false;
    let objectUrl = '';
    setStatus('Loading media…');
    void mediaObjectUrl(assetId).then((nextUrl) => {
      if (disposed) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      objectUrl = nextUrl;
      setUrl(nextUrl);
      setStatus('');
    }).catch(() => setStatus('Media missing · relink in LumaRig'));
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl('');
    };
  }, [assetId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !transport) return;
    const desired = Math.max(0, transport.positionMs / 1000);
    if (Math.abs(video.currentTime - desired) > .15) {
      try { video.currentTime = desired; } catch { /* metadata may not be ready yet */ }
    }
    if (transport.playing) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [transport?.positionMs, transport?.playing, url]);

  return <main className="media-output-window">
    {url
      ? <video ref={videoRef} src={url} playsInline preload="auto" />
      : <div className="media-output-status">{status}</div>}
  </main>;
}
