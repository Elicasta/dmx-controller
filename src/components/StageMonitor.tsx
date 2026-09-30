import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { readFixtureParameter, type PatchedFixture } from '../lib/fixtures';
import { stageElementPosition, type StageElement } from '../lib/stage';
import { fixtureGeometryState } from '../core/fixture-geometry';
import { intersectBeamWithStage } from '../core/beam-intersection';
import { pointAlongRay, type StageDimensions } from '../core/geometry';
import { projectStagePoint, type StageView } from '../core/stage-projection';
export type StageSnapshot={patch:PatchedFixture[];output:number[];dimensions:StageDimensions;elements:StageElement[];blackout:boolean};
const CHANNEL='lumarig-stage-monitor-v1';
export function useStagePublisher(snapshot:StageSnapshot) {
 const current=useRef(snapshot);current.current=snapshot;
 const channel=useRef<BroadcastChannel|null>(null);
 useEffect(()=>{const c=new BroadcastChannel(CHANNEL);channel.current=c;c.onmessage=e=>{if(e.data?.type==='ready')c.postMessage({type:'frame',snapshot:current.current});};return()=>{c.close();channel.current=null;};},[]);
 useEffect(()=>{channel.current?.postMessage({type:'frame',snapshot});},[snapshot]);
}
export async function openStageWindow():Promise<boolean> {
 if('__TAURI_INTERNALS__' in window){try{await invoke('open_stage_monitor');return true;}catch{return false;}}
 return Boolean(window.open(new URL('?stage-monitor=1',window.location.href).href,'lumarig-stage-monitor','width=960,height=620'));
}
function Scene({data,view}:{data:StageSnapshot;view:StageView}) {
 return <svg className="stage-monitor-scene" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet" aria-label="Live stage output">
  <rect x="80" y="56" width="840" height="448" rx="8" fill="#111c26" stroke="#354755"/>
  {Array.from({length:15},(_,i)=><line key={i} x1={80+i*60} y1="56" x2={80+i*60} y2="504" stroke="#1c2d3a"/>)}
  {data.elements.map(e=>{const p=projectStagePoint(stageElementPosition(e,data.dimensions),data.dimensions,view);return <g key={e.id}><rect x={p.x-18} y={p.y-12} width="36" height="24" fill={e.color} opacity=".4"/><text x={p.x} y={p.y+30} textAnchor="middle" fill="#a9bdca" fontSize="12">{e.label}</text></g>;})}
  {data.patch.map((f,i)=>{
   const g=fixtureGeometryState(data.output,f,i,data.patch.length,data.dimensions);
   const a=projectStagePoint(g.beam.origin,data.dimensions,view);
   const hit=intersectBeamWithStage(g.beam,data.dimensions);
   const b=projectStagePoint(hit?.point??pointAlongRay(g.beam,Math.max(data.dimensions.width,data.dimensions.depth,data.dimensions.height)*1.2),data.dimensions,view);
   const rgb=['red','green','blue'].map(p=>readFixtureParameter(data.output,f,p as 'red'|'green'|'blue'));
   const uv=readFixtureParameter(data.output,f,'uv');
   const color=rgb.some(v=>v>0)?'rgb('+rgb.join(' ')+')':uv?'#7840ff':'#ffffff';
   const level=data.blackout?0:readFixtureParameter(data.output,f,'dimmer')/255;
   const width=Math.max(4,g.beam.angleDegrees*.65);
   return <g key={f.id} data-fixture={f.id} data-level={level}>
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width*2.4} opacity={level*.15}/>
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} opacity={level*.7}/>
    <circle cx={b.x} cy={b.y} r={width} fill={color} opacity={level*.5}/>
    <circle cx={a.x} cy={a.y} r="8" fill="#17232b" stroke={f.labelColor||'#849cae'}/>
    <text x={a.x} y={a.y-15} fill="#dce8ee" fontSize="12" textAnchor="middle">{f.name}</text>
   </g>;
  })}
 </svg>;
}
export default function StageMonitor({snapshot,floating=false,onClose}:{snapshot?:StageSnapshot;floating?:boolean;onClose?:()=>void}) {
 const [incoming,setIncoming]=useState<StageSnapshot|null>(null),[view,setView]=useState<StageView>('perspective'),[collapsed,setCollapsed]=useState(false);
 const [position,setPosition]=useState(()=>({x:Math.max(20,window.innerWidth-600),y:Math.max(80,window.innerHeight-420)}));const drag=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{if(snapshot)return;const c=new BroadcastChannel(CHANNEL);c.onmessage=e=>{if(e.data?.type==='frame')setIncoming(e.data.snapshot);};c.postMessage({type:'ready'});return()=>c.close();},[Boolean(snapshot)]);
 const data=snapshot??incoming;
 return <section className={`stage-monitor ${floating?'floating-stage-monitor':''} ${collapsed?'collapsed':''}`} style={floating?{left:position.x,top:position.y}:undefined}>
  <header onPointerDown={e=>{if(!floating||(e.target as HTMLElement).closest('button'))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX-position.x,y:e.clientY-position.y};}}
    onPointerMove={e=>{if(drag.current)setPosition({x:Math.max(0,Math.min(window.innerWidth-(e.currentTarget.parentElement?.getBoundingClientRect().width??580),e.clientX-drag.current.x)),y:Math.max(0,Math.min(window.innerHeight-(e.currentTarget.parentElement?.getBoundingClientRect().height??360),e.clientY-drag.current.y))});}}
    onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}>
   <strong>STAGE · LIVE OUTPUT</strong><div>{floating&&<><button onClick={()=>void openStageWindow().then(open=>{if(open)onClose?.();})}>Pop out ↗</button><button aria-label="Collapse stage monitor" onClick={()=>setCollapsed(!collapsed)}>{collapsed?'Expand':'Collapse'}</button></>}{onClose&&<button aria-label="Close stage monitor" onClick={onClose}>×</button>}</div>
  </header>
  {!collapsed&&<><nav>{(['perspective','top','front','side'] as StageView[]).map(v=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{v}</button>)}</nav>{data?<Scene data={data} view={view}/>:<p>Waiting for LumaRig output…</p>}</>}
 </section>;
}
