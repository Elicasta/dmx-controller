import { followTimelineVideo } from '../lib/timeline-video';
import { readNativeMediaBlob } from '../lib/media-library';
import { useEffect, useRef, useState } from 'react';
import type { StageScreenSource } from '../lib/stage';

export type StageVideoInputOption = {
  deviceId: string;
  label: string;
};

export type StageVideoInputErrorCode =
  | 'permission-denied'
  | 'device-busy'
  | 'no-device'
  | 'unsupported'
  | 'unknown';

export class StageVideoInputError extends Error {
  readonly code: StageVideoInputErrorCode;

  constructor(code: StageVideoInputErrorCode, message: string) {
    super(message);
    this.name = 'StageVideoInputError';
    this.code = code;
  }
}

function describeVideoInputFailure(error: unknown): StageVideoInputError {
  const name = error instanceof DOMException ? error.name : '';
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();

  if (name === 'NotAllowedError' || name === 'SecurityError' || lower.includes('not allowed') || lower.includes('denied permission')) {
    return new StageVideoInputError(
      'permission-denied',
      'Video input access is blocked. Allow LumaRig camera access in your system privacy settings, then quit and reopen LumaRig before scanning again.'
    );
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || lower.includes('could not start video source') || lower.includes('in use')) {
    return new StageVideoInputError(
      'device-busy',
      'The video input is busy or unavailable. Close any app using that camera or NDI virtual input, then scan again.'
    );
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new StageVideoInputError(
      'no-device',
      'No camera or virtual video input is available. Start your NDI Virtual Input/Webcam source, then scan again.'
    );
  }
  return new StageVideoInputError(
    'unknown',
    raw || 'Video input scanning failed.'
  );
}

export async function requestStageVideoInputs(): Promise<StageVideoInputOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices || !navigator.mediaDevices?.getUserMedia) {
    throw new StageVideoInputError(
      'unsupported',
      'Video inputs are not available in this runtime.'
    );
  }

  let permissionStream: MediaStream | null = null;
  try {
    permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (error) {
    throw describeVideoInputFailure(error);
  } finally {
    permissionStream?.getTracks().forEach((track) => track.stop());
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Video Input ${index + 1}`
      }));
  } catch (error) {
    throw describeVideoInputFailure(error);
  }
}

export function StageMediaSurface({ source }: { source?: StageScreenSource }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [imageUrl,setImageUrl]=useState('');

  useEffect(() => {
    if(source?.kind==='timeline' && videoRef.current){setStatus('connecting');return followTimelineVideo(videoRef.current,visible=>setStatus(visible?'live':'idle'));}
    if (!source || source.kind !== 'ndi' || !source.deviceId || !navigator.mediaDevices?.getUserMedia) {
      setStatus('idle');
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

  useEffect(()=>{
    if(source?.kind!=='image' || !source.mediaId){setImageUrl('');return;}
    let cancelled=false,url='';
    setStatus('connecting');
    void readNativeMediaBlob(source.mediaId).then(blob=>{
      if(cancelled)return;
      if(!blob)throw Error('Image asset is unavailable.');
      url=URL.createObjectURL(blob);
      setImageUrl(url);
      setStatus('live');
    }).catch(()=>{if(!cancelled){setImageUrl('');setStatus('error');}});
    return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};
  },[source?.kind,source?.kind==='image'?source.mediaId:undefined]);

  if (!source || source.kind === 'none') return null;

  if(source.kind==='color')return <span className="stage-media-surface screen-solid-source" style={{backgroundColor:source.color}} aria-label={`Solid screen color ${source.color}`}/>;
  if(source.kind==='test-pattern')return <span className="stage-media-surface screen-test-pattern" data-pattern={source.pattern} aria-label={`${source.pattern} screen test pattern`}/>;

  if (source.kind==='ndi' && !source.deviceId) {
    return <span className="stage-media-placeholder">NDI · select input</span>;
  }

  const framing={
    objectFit: source.fit ?? 'contain',
    transform: `translate(${(source.offsetX ?? 0) * 50}%, ${(source.offsetY ?? 0) * 50}%) scale(${source.scale ?? 1})`,
    transformOrigin:'center center'
  } as const;

  if(source.kind==='image'){
    return <span className="stage-media-surface" data-state={status}>
      {imageUrl&&<img src={imageUrl} alt={source.sourceName || 'Stage screen image'} style={framing}/>}
      {status!=='live'&&<span className="stage-media-status">{status==='connecting'?'Loading image…':'Image unavailable'}</span>}
    </span>;
  }

  return <span className="stage-media-surface" data-state={status}>
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      aria-label={source.sourceName ? `${source.sourceName} screen feed` : 'Live stage screen feed'}
      style={{...framing,visibility:source.kind==='timeline' && status!=='live'?'hidden':undefined}}
    />
    {status !== 'live' && <span className="stage-media-status">{status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Input unavailable' : source.kind==='timeline' ? 'Load Timeline video' : 'NDI'}</span>}
  </span>;
}
