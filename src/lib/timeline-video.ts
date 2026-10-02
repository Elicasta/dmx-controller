import { MEDIA_CHANNEL, type MediaOutputFrame } from '../components/MediaOutput';
/** Silent follower of the authoritative media element; never creates another transport. */
export function followTimelineVideo(video: HTMLVideoElement, onChange: (visible:boolean)=>void = ()=>{}) {
  const channel=new BroadcastChannel(MEDIA_CHANNEL);
  let state:MediaOutputFrame|null=null, source='', disposed=false, starting=false;
  const sync=()=>{
    if(disposed)return;
    const active=Boolean(state && /\.(mp4|mov|webm|m4v)$/i.test(state.name) && state.url && Date.now()-state.sentAt<2000);
    onChange(active);
    if(!active){video.pause();return;}
    const next=state!;
    if(source!==next.url){source=next.url;video.src=source;video.load();}
    if(video.readyState<1)return;
    const position=next.position+(next.playing?Math.min(.25,Math.max(0,Date.now()-next.sentAt)/1000):0);
    if(Math.abs(video.currentTime-position)>.08)video.currentTime=position;
    if(next.playing && video.paused && !starting){starting=true;void video.play().catch(()=>{}).finally(()=>{starting=false;if(disposed || !state?.playing)video.pause();});}
    else if(!next.playing)video.pause();
  };
  video.muted=true;video.playsInline=true;video.preload='auto';
  channel.onmessage=e=>{if(e.data?.type==='frame' && typeof e.data.state?.url==='string' && Number.isFinite(e.data.state?.position)){state=e.data.state;sync();}};
  video.addEventListener('loadedmetadata',sync);video.addEventListener('canplay',sync);
  const timer=setInterval(()=>{channel.postMessage({type:'ready'});sync();},250);
  channel.postMessage({type:'ready'});
  return()=>{disposed=true;clearInterval(timer);channel.close();video.removeEventListener('loadedmetadata',sync);video.removeEventListener('canplay',sync);video.pause();video.removeAttribute('src');video.load();};
}
