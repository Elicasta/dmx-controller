import {barMs,type ShowTimeline,type TimelineMediaClip} from './show-design';
export function activeVideoClip(timeline:ShowTimeline,elapsedMs:number):{clip:TimelineMediaClip;position:number}|null {
  const duration=barMs(timeline),bar=elapsedMs/duration;
  const clip=(timeline.videoClips??[]).filter(c=>c.enabled && bar>=c.startBar && bar<c.startBar+c.lengthBars && elapsedMs-c.startBar*duration+c.trimInMs<c.trimOutMs).sort((a,b)=>a.startBar-b.startBar || a.id.localeCompare(b.id)).at(-1);
  return clip?{clip,position:(elapsedMs-clip.startBar*duration+clip.trimInMs)/1000}:null;
}
export async function videoDuration(file:Blob):Promise<number>{
  const video=document.createElement('video'),url=URL.createObjectURL(file);
  try{return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Video metadata unavailable. Choose a supported MP4.')),10000);
    video.onloadedmetadata=()=>{clearTimeout(timer);Number.isFinite(video.duration) && video.duration>0?resolve(video.duration*1000):reject(Error('Video has no finite duration.'));};
    video.onerror=()=>{clearTimeout(timer);reject(Error('This video codec could not be opened.'));};video.preload='metadata';video.src=url;
  });}finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
