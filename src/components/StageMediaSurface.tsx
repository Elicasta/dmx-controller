import { useEffect, useRef, useState } from 'react';
import { mediaObjectUrl } from '../lib/media-library';
import type { StageScreenSource } from '../lib/stage';

export type StageVideoInputOption = {
  deviceId: string;
  label: string;
};

export async function requestStageVideoInputs(): Promise<StageVideoInputOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Video inputs are not available in this runtime.');
  }

  const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  permissionStream.getTracks().forEach((track) => track.stop());

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Video Input ${index + 1}`
    }));
}

export function StageMediaSurface({ source }: { source?: StageScreenSource }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');

  useEffect(() => {
    if (!source || source.kind !== 'media') {
      setMediaUrl('');
      return;
    }
    let cancelled = false;
    let objectUrl = '';
    setStatus('connecting');
    void mediaObjectUrl(source.assetId).then((url) => {
      if (cancelled) return URL.revokeObjectURL(url);
      objectUrl = url;
      setMediaUrl(url);
      setStatus('live');
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setMediaUrl('');
    };
  }, [source?.kind, source?.kind === 'media' ? source.assetId : undefined]);

  useEffect(() => {
    if (!source || source.kind !== 'ndi' || !source.deviceId || !navigator.mediaDevices?.getUserMedia) {
      if (source?.kind !== 'media') setStatus('idle');
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    setStatus('connecting');

    void navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: source.deviceId } },
      audio: false
    }).then(async (nextStream) => {
      if (cancelled) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = nextStream;
      if (videoRef.current) {
        videoRef.current.srcObject = nextStream;
        try {
          await videoRef.current.play();
          if (!cancelled) setStatus('live');
        } catch {
          if (!cancelled) setStatus('error');
        }
      }
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [source?.kind, source?.kind === 'ndi' ? source.deviceId : undefined]);

  if (!source || source.kind === 'none') return null;

  if (source.kind === 'media') {
    if (!mediaUrl) {
      return <span className="stage-media-placeholder">{status === 'error' ? 'Media missing · relink' : 'Loading media…'}</span>;
    }
    if (source.mediaKind === 'image') {
      return <span className="stage-media-surface" data-state={status}>
        <img src={mediaUrl} alt={source.sourceName ?? 'Stage screen media'} style={{ width: '100%', height: '100%', objectFit: source.fit ?? 'contain' }}/>
      </span>;
    }
    return <span className="stage-media-surface" data-state={status}>
      <video
        ref={videoRef}
        src={mediaUrl}
        autoPlay
        muted={source.muted ?? true}
        loop={source.loop ?? true}
        playsInline
        aria-label={source.sourceName ? `${source.sourceName} screen media` : 'Stage screen media'}
        style={{ objectFit: source.fit ?? 'contain' }}
      />
      {status !== 'live' && <span className="stage-media-status">{status === 'error' ? 'Media unavailable' : 'Loading…'}</span>}
    </span>;
  }

  if (!source.deviceId) {
    return <span className="stage-media-placeholder">NDI · select input</span>;
  }

  return <span className="stage-media-surface" data-state={status}>
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      aria-label={source.sourceName ? `${source.sourceName} screen feed` : 'Live stage screen feed'}
      style={{ objectFit: source.fit ?? 'contain' }}
    />
    {status !== 'live' && <span className="stage-media-status">{status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Input unavailable' : 'NDI'}</span>}
  </span>;
}
