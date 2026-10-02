import { useEffect, useState, type RefObject } from 'react';
import TempoInput from './TempoInput';
export default function RecorderTransport({audioRef,position,duration,bpm,beatsPerBar,recording,paused,onPlay,onPause,onStop,onSeek,onBpm}:{
  audioRef:RefObject<HTMLAudioElement|null>;position:number;duration:number;bpm:number;beatsPerBar:number;
  recording:boolean;paused:boolean;onPlay:()=>void;onPause:()=>void;onStop:()=>void;onSeek:(ms:number)=>void;onBpm:(bpm:number)=>void;
}){
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{const audio=audioRef.current;const sync=()=>setPlaying(Boolean(audio&&!audio.paused));audio?.addEventListener('play',sync);audio?.addEventListener('pause',sync);sync();return()=>{audio?.removeEventListener('play',sync);audio?.removeEventListener('pause',sync);};},[audioRef]);
  const beats=position*bpm/60000;
  return <div className="timeline-toolbar recorder-transport">
    <button onClick={onPlay}>{recording && paused?'Resume':'Play'}</button><button onClick={onPause}>Pause</button><button onClick={onStop}>{recording?'Stop + save':'Stop'}</button>
    <button aria-label="Rewind recording" disabled={recording} onClick={()=>onSeek(0)}>Rewind</button>
    <button disabled={recording} onClick={()=>onSeek(Math.max(0,position-60000/bpm))}>‹ Beat</button><button disabled={recording} onClick={()=>onSeek(position+60000/bpm)}>Beat ›</button>
    <button disabled={recording} onClick={()=>onSeek(Math.max(0,position-beatsPerBar*60000/bpm))}>‹ Bar</button><button disabled={recording} onClick={()=>onSeek(position+beatsPerBar*60000/bpm)}>Bar ›</button>
    <output aria-label="Recording position">BAR {Math.floor(beats/beatsPerBar)+1} · BEAT {Math.floor(beats%beatsPerBar)+1} · {(position/1000).toFixed(1)} s</output>
    <label>BPM<TempoInput label="Recording BPM" value={bpm} disabled={recording} onChange={onBpm}/></label>
    <small>{recording?(paused?'Recording paused':'Recording'):playing?'Playing':'Paused'} · Internal Media</small>
    <label className="recorder-seek">Playhead<input aria-label="Recording playhead" type="range" min={0} max={Math.max(1,duration)} step={10} value={Math.min(position,duration)} disabled={recording} onChange={e=>onSeek(Number(e.target.value))}/></label>
  </div>;
}
