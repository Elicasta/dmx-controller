import { Children, useRef, useState, type ReactNode, type CSSProperties } from 'react';
export default function ResizableWorkspace({children,className}:{children:ReactNode;className:string}) {
 const ref=useRef<HTMLElement|null>(null);
 const [left,setLeft]=useState(180),[right,setRight]=useState(190),[hideLeft,setHideLeft]=useState(false),[hideRight,setHideRight]=useState(false);
 const drag=useRef<'left'|'right'|null>(null);
 const hasRight=Children.toArray(children).length>2;
 const move=(x:number)=>{
  const box=ref.current?.getBoundingClientRect();if(!box)return;
  const max=Math.max(160,box.width*.35);
  if(drag.current==='left')setLeft(Math.max(140,Math.min(max,x-box.left)));
  if(drag.current==='right')setRight(Math.max(150,Math.min(max,box.right-x)));
 };
 const divider=(side:'left'|'right',value:number)=><div className={'workspace-divider divider-'+side} role="separator" aria-label={'Resize '+side+' panel'} aria-orientation="vertical" aria-valuemin={140} aria-valuemax={Math.round((ref.current?.clientWidth??1000)*.35)} aria-valuenow={value} tabIndex={0}
  style={side==='left'?{left:value+4}:{right:value+4}}
  onPointerDown={e=>{e.preventDefault();drag.current=side;e.currentTarget.setPointerCapture(e.pointerId);}}
  onPointerMove={e=>{if(drag.current===side)move(e.clientX);}}
  onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
  onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const delta=e.key==='ArrowRight'?10:-10;if(side==='left')setLeft(Math.max(140,left+delta));else setRight(Math.max(150,right-delta));}}}/>;
 return <section ref={ref} className={className+' resizable-workspace'+(hideLeft?' left-collapsed':'')+(hideRight?' right-collapsed':'')}
  style={{'--workspace-columns':(hideLeft?'':left+'px ')+'minmax(0,1fr)'+(hasRight&&!hideRight?' '+right+'px':'')} as CSSProperties}>
  <div className="workspace-panel-tools"><button onClick={()=>setHideLeft(!hideLeft)}>{hideLeft?'Show':'Collapse'} Fixtures</button>{hasRight&&<button onClick={()=>setHideRight(!hideRight)}>{hideRight?'Show':'Collapse'} FX</button>}</div>
  {children}
  {!hideLeft&&divider('left',left)}{hasRight&&!hideRight&&divider('right',right)}
 </section>;
}
