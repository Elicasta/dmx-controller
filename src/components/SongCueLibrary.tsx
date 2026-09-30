import { useState } from 'react';
import type { ShowCue, ShowFile } from '../lib/show';
import { isShowFile } from '../lib/show';
type Props = {
 cues: ShowCue[]; activeId: string | null; timelineNames: string[];
 onRun: (cue:ShowCue)=>void; onDelete:(id:string)=>void; onMove:(id:string,direction:-1|1)=>void;
 onMoveSong:(name:string,direction:-1|1)=>void; onCapture:()=>void;
 onTimeline:(song:string)=>void; onImport:(show:ShowFile)=>void;
};
export default function SongCueLibrary(p:Props) {
 const [query,setQuery]=useState(''),[closed,setClosed]=useState<Record<string,boolean>>({}),[error,setError]=useState('');
 const names=[...new Set(p.cues.map(c=>c.trackName?.trim()||'Unfiled cues'))];
 const matches=(c:ShowCue)=>(c.name+' '+(c.trackName||'')).toLowerCase().includes(query.toLowerCase());
 return <aside className="cue-list-console song-cue-library">
  <header><span>SONGS / CUES</span><button onClick={p.onCapture}>＋ Capture</button></header>
  <input aria-label="Search songs and cues" placeholder="Find a song or cue…" value={query} onChange={e=>setQuery(e.target.value)}/>
  <label className="file-button">Import timeline show<input aria-label="Import timeline show" type="file" accept=".json,application/json" onChange={async e=>{
   const f=e.target.files?.[0];e.target.value='';if(!f)return;
   try {const value=JSON.parse(await f.text());if(!isShowFile(value))throw Error('Choose an exported LumaRig show JSON file.');p.onImport(value);setError('');}
   catch(err){setError(String(err));}
  }}/></label>
  {error&&<p role="alert">{error}</p>}
  {names.map((name,index)=>{
   const cues=p.cues.filter(c=>(c.trackName?.trim()||'Unfiled cues')===name&&matches(c));
   if(!cues.length)return null;
   const expanded=Boolean(query)||!(closed[name]??(names.length>1));
   return <section className="song-cue-group" key={name}>
    <header><button className="song-toggle" aria-expanded={expanded} onClick={()=>setClosed({...closed,[name]:expanded})}><strong>{expanded?'▾':'▸'} {name}</strong><small>{cues.length} cues{p.timelineNames.includes(name)?' · timeline show':''}</small></button>
    <div><button aria-label={'Move song '+name+' up'} disabled={index===0} onClick={()=>p.onMoveSong(name,-1)}>↑</button><button aria-label={'Move song '+name+' down'} disabled={index===names.length-1} onClick={()=>p.onMoveSong(name,1)}>↓</button><button aria-label={'Open timeline for '+name} onClick={()=>p.onTimeline(name)}>Timeline</button></div></header>
    {expanded&&cues.map(cue=><article key={cue.id} className={p.activeId===cue.id?'active':''}>
     <button className="cue-line" onClick={()=>p.onRun(cue)}><b>{cue.number}</b><i style={{background:cue.color||'#55e98d'}}/><span><strong>{cue.name}</strong><small>{cue.fadeMs/1000}s fade · {cue.effectStack?.length||0} FX</small></span></button>
     <div><button aria-label={'Move '+cue.name+' up'} onClick={()=>p.onMove(cue.id,-1)}>↑</button><button aria-label={'Move '+cue.name+' down'} onClick={()=>p.onMove(cue.id,1)}>↓</button><button aria-label={'Delete '+cue.name} onClick={()=>p.onDelete(cue.id)}>×</button></div>
    </article>)}
   </section>;
  })}
  {!p.cues.length&&<p>Build a song in Show Creator or capture your first cue.</p>}
 </aside>;
}
