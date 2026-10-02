import { useEffect, useRef, useState, type RefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
export const MEDIA_CHANNEL='lumarig-media-output-v1';
const CHANNEL=MEDIA_CHANNEL;
export type MediaOutputFrame={url:string;name:string;position:number;playing:boolean;sentAt:number;};
export function useMediaOutputPublisher(audioRef:RefObject<HTMLAudioElement|null>,url:string,name:string,overrideRef?:RefObject<MediaOutputFrame|null>){
  useEffect(()=>{
    const channel=new BroadcastChannel(CHANNEL);
    let frame=0,last=0;
    const publish=()=>{
      const audio=audioRef.current;
      const state:MediaOutputFrame={url,name,position:audio?.currentTime??0,playing:Boolean(audio&&!audio.paused&&!audio.ended),sentAt:Date.now()};
      channel.postMessage({type:'frame',state:overrideRef?.current ? {...overrideRef.current,sentAt:Date.now()} : state});
    };
    channel.onmessage=e=>{if(e.data?.type==='ready')publish();};
    const audio=audioRef.current;
    const events=['play','pause','seeked','loadedmetadata','ended','emptied'];
    for(const event of events)audio?.addEventListener(event,publish);
    const tick=(now:number)=>{if(now-last>=50){publish();last=now;}frame=requestAnimationFrame(tick);};
    const heartbeat=setInterval(publish,250);
    publish();frame=requestAnimationFrame(tick);
    return()=>{clearInterval(heartbeat);cancelAnimationFrame(frame);for(const event of events)audio?.removeEventListener(event,publish);channel.postMessage({type:'frame',state:{url:'',name:'',position:0,playing:false,sentAt:Date.now()}});channel.close();};
  },[audioRef,url,name,overrideRef]);
}
export async function openMediaOutput():Promise<void>{
  if('__TAURI_INTERNALS__'in window){await invoke('open_media_output');return;}
  if(!window.open(new URL('?media-output=1',window.location.href).href,'lumarig-media-output','width=1280,height=720'))throw Error('Allow the video output window to open.');
}
export default function MediaOutput(){
  const video=useRef<HTMLVideoElement|null>(null);
  const incoming=useRef<MediaOutputFrame|null>(null);
  const [url,setUrl]=useState(''),[error,setError]=useState('');
  const starting=useRef(false);
  function synchronize(){
    const element=video.current,state=incoming.current;
    if(!element||!state||!state.url||element.readyState<1)return;
    const position=state.position+(state.playing?Math.min(.2,Math.max(0,Date.now()-state.sentAt)/1000):0);
    if(Number.isFinite(position)&&Math.abs(element.currentTime-position)>.12)element.currentTime=position;
    if(state.playing&&element.paused&&!starting.current){
      starting.current=true;
      void element.play().catch(()=>setError('Click output to enable video playback.')).finally(()=>{starting.current=false;if(!incoming.current?.playing)element.pause();});
    }else if(!state.playing)element.pause();
  }
  useEffect(()=>{
    const channel=new BroadcastChannel(CHANNEL);
    channel.onmessage=e=>{
      if(e.data?.type!=='frame')return;
      const state=e.data.state as MediaOutputFrame;
      if(!state||typeof state.url!=='string'||!Number.isFinite(state.position))return;
      incoming.current=state;setUrl(state.url);
      synchronize();
    };
    channel.postMessage({type:'ready'});
    const timer=setInterval(()=>channel.postMessage({type:'ready'}),1000);
    return()=>{clearInterval(timer);channel.close();video.current?.pause();};
  },[]);
  async function fullscreen(){
    try{
      if('__TAURI_INTERNALS__'in window)await invoke('toggle_media_output_fullscreen');
      else if(document.fullscreenElement)await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    }catch{setError('Fullscreen could not open. Use the window fullscreen control.');}
  }
  return <main className="media-output" onDoubleClick={()=>void fullscreen()} onClick={()=>{setError('');synchronize();}}>
    <video ref={video} src={url||undefined} muted playsInline preload="auto" onLoadedMetadata={synchronize} onCanPlay={synchronize} onError={()=>setError('Video unavailable. Relink its Song media in LumaRig.')} aria-label="Synchronized video output" />

    {error&&<p role="status">{error}</p>}
    <button className="media-output-fullscreen" onClick={e=>{e.stopPropagation();void fullscreen();}}>Fullscreen</button>
  </main>;
}
