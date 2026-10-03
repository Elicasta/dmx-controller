import { followTimelineVideo } from '../lib/timeline-video';
import { readNativeMediaBlob } from '../lib/media-library';
import { useEffect, useRef, useState } from 'react';
import type { StageScreenSource } from '../lib/stage';

export type StageVideoInputOption = {
  deviceId: string;
  label: string;
};

export type StageVideoInputScanResult = {
  inputs: StageVideoInputOption[];
  permission: 'granted' | 'limited';
  warning?: string;
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

async function cameraPermissionState(): Promise<PermissionState | 'unknown'> {
  const permissions = navigator.permissions;
  if (!permissions?.query) return 'unknown';
  try {
    const result = await permissions.query({ name: 'camera' as PermissionName });
    return result.state;
  } catch {
    return 'unknown';
  }
}

export async function requestStageVideoInputs(): Promise<StageVideoInputScanResult> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new StageVideoInputError(
      'unsupported',
      'Video input discovery is not available in this runtime.'
    );
  }

  const enumerate = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Video Input ${index + 1}`
      }));
  };

  let beforePermission: StageVideoInputOption[] = [];
  try {
    beforePermission = await enumerate();
  } catch (error) {
    throw describeVideoInputFailure(error);
  }

  const hasNamedInput = beforePermission.some((input) => !/^Video Input \d+$/i.test(input.label));
  if (hasNamedInput) {
    return { inputs: beforePermission, permission: 'granted' };
  }

  const permissionState = await cameraPermissionState();
  if (permissionState === 'denied') {
    return {
      inputs: beforePermission,
      permission: 'limited',
      warning: 'Camera/video-input permission is blocked for LumaRig. Open Camera Privacy Settings, enable LumaRig, quit the app completely, then reopen and scan again.'
    };
  }

  if (!navigator.mediaDevices.getUserMedia) {
    if (beforePermission.length) {
      return {
        inputs: beforePermission,
        permission: 'limited',
        warning: 'Video inputs were found, but this runtime cannot request camera permission. Their names and live preview may remain unavailable.'
      };
    }
    throw new StageVideoInputError('unsupported', 'Live video input access is not available in this runtime.');
  }

  let permissionStream: MediaStream | null = null;
  try {
    // Prefer a concrete device when enumerateDevices already exposed one. This
    // is friendlier to macOS virtual-camera bridges such as NDI Webcam Input
    // than asking WebKit for an arbitrary default camera.
    const firstDeviceId = beforePermission.find((input) => input.deviceId)?.deviceId;
    permissionStream = await navigator.mediaDevices.getUserMedia({
      video: firstDeviceId ? { deviceId: { exact: firstDeviceId } } : true,
      audio: false
    });
  } catch (error) {
    const described = describeVideoInputFailure(error);
    if (described.code === 'permission-denied') {
      return {
        inputs: beforePermission,
        permission: 'limited',
        warning: described.message
      };
    }
    if (described.code === 'no-device' && beforePermission.length) {
      return {
        inputs: beforePermission,
        permission: 'limited',
        warning: 'LumaRig can see video-input device records, but none can be opened. Start NDI Webcam Input / Virtual Input, then scan again.'
      };
    }
    throw described;
  } finally {
    permissionStream?.getTracks().forEach((track) => track.stop());
  }

  try {
    const afterPermission = await enumerate();
    return {
      inputs: afterPermission,
      permission: afterPermission.some((input) => !/^Video Input \d+$/i.test(input.label)) ? 'granted' : 'limited',
      warning: afterPermission.length && afterPermission.every((input) => /^Video Input \d+$/i.test(input.label))
        ? 'Video permission was granted, but macOS/WebKit is still hiding device names. Quit and reopen LumaRig once, then scan again.'
        : undefined
    };
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
