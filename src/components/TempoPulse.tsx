import { useEffect, useRef, type RefObject } from 'react';
export default function TempoPulse({bpm,audioRef,running}:{bpm:number;audioRef:RefObject<HTMLAudioElement|null>;running:boolean}) {
  const dot=useRef<HTMLSpanElement|null>(null);
  useEffect(()=>{
    let frame=0; const start=performance.now();
    const tick=(now:number)=>{
      const media=audioRef.current; const active=running || Boolean(media && !media.paused && !media.ended);
      const seconds=media && !media.paused ? media.currentTime : (now-start)/1000;
      const phase=(seconds*bpm/60)%1;
      if(dot.current){dot.current.dataset.running=String(active);dot.current.style.opacity=active && phase<.18 ? '1' : '.22';}
      frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[bpm,audioRef,running]);
  return <span ref={dot} className="tempo-pulse" aria-label="Tempo beat indicator" />;
}
