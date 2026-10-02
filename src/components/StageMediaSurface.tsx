import { followTimelineVideo } from '../lib/timeline-video';
import { readNativeMediaBlob } from '../lib/media-library';
import { useEffect, useRef, useState } from 'react';
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
