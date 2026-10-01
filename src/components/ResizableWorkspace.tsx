import { Children, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

type Layout = { left: number; right: number; hideLeft: boolean; hideRight: boolean };
const defaults: Layout = { left:180, right:190, hideLeft:false, hideRight:false };
function restore(key: string, fallback: Layout): Layout {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.right)
      && typeof saved.hideLeft === 'boolean' && typeof saved.hideRight === 'boolean')
      return { ...saved, left:Math.max(160,Math.min(420,saved.left)), right:Math.max(180,Math.min(420,saved.right)) };
  } catch { /* Optional layout preference. */ }
  return fallback;
}
export default function ResizableWorkspace({children,className,storageKey='lumarig.programmer-columns.v2',leftLabel='Fixtures',rightLabel='FX',leftEnabled=true,rightEnabled,leftDefault=180,rightDefault=190,centerMinimum=480,compactMode='collapse'}:{
  children:ReactNode;className:string;storageKey?:string;leftLabel?:string;rightLabel?:string;
  leftEnabled?:boolean;rightEnabled?:boolean;leftDefault?:number;rightDefault?:number;centerMinimum?:number;compactMode?:'collapse'|'stack';
}) {
  const initial = {...defaults,left:leftDefault,right:rightDefault};
  const ref=useRef<HTMLElement|null>(null);
  const [layout,setLayout]=useState(()=>restore(storageKey,initial)), [width,setWidth]=useState(1280);
  const drag=useRef<{side:'left'|'right';x:number;size:number}|null>(null);
  const hasRight=rightEnabled ?? (Children.toArray(children).length>2);
  useEffect(()=>{
    const element=ref.current;if(!element)return;
    const observer=new ResizeObserver(()=>setWidth(element.clientWidth));
    observer.observe(element);setWidth(element.clientWidth);
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(layout));}catch{/* Optional preference. */}},[layout,storageKey]);
  // Protect the editor first. Secondary panels collapse instead of crushing its controls.
  const budget=Math.max(0,width-20-centerMinimum);
  const stacked=compactMode==='stack' && budget < (leftEnabled&&!layout.hideLeft?160:0)+(hasRight&&!layout.hideRight?180:0);
  const left=Math.min(layout.left,Math.max(160,budget));
  const hideLeft=!leftEnabled || layout.hideLeft || (!stacked&&budget<160);
  const right=Math.min(layout.right,Math.max(180,budget-(hideLeft?0:left)));
  const hideRight=layout.hideRight || !hasRight || (!stacked&&budget-(hideLeft?0:left)<180);
  const resize=(side:'left'|'right',size:number)=>{
    const other=side==='left'?(hideRight?0:right):(hideLeft?0:left);
    const min=side==='left'?160:180,max=Math.max(min,Math.min(420,budget-other));
    setLayout(current=>({...current,[side]:Math.max(min,Math.min(max,size))}));
  };
  const divider=(side:'left'|'right',value:number)=><div className={'workspace-divider divider-'+side} role="separator" aria-label={'Resize '+(side==='left'?leftLabel:rightLabel)+' panel'} aria-orientation="vertical" aria-valuemin={side==='left'?160:180} aria-valuemax={Math.max(side==='left'?160:180,Math.min(420,budget-(side==='left'?(hideRight?0:right):(hideLeft?0:left))))} aria-valuenow={value} tabIndex={0}
    title="Drag to resize. Double-click to reset. Arrow keys adjust width."
    style={side==='left'?{left:value+4}:{right:value+4}}
    onDoubleClick={()=>setLayout(current=>({...current,[side]:initial[side]}))}
    onPointerDown={e=>{e.preventDefault();drag.current={side,x:e.clientX,size:value};e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{if(drag.current?.side===side)resize(side,drag.current.size+(e.clientX-drag.current.x)*(side==='left'?1:-1));}}
    onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onPointerCancel={()=>{drag.current=null;}}
    onLostPointerCapture={()=>{drag.current=null;}}
    onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();resize(side,value+(e.key==='ArrowRight'?10:-10)*(side==='left'?1:-1));}else if(e.key==='Home'){e.preventDefault();setLayout(current=>({...current,[side]:initial[side]}));}}}/>;
  return <section ref={ref} className={className+' resizable-workspace'+(hideLeft?' left-collapsed':'')+(hideRight?' right-collapsed':'')+(stacked?' panels-stacked':'')}
    style={{'--workspace-columns':stacked?'minmax(0,1fr)':(hideLeft?'':left+'px ')+'minmax(0,1fr)'+(hasRight&&!hideRight?' '+right+'px':'')} as CSSProperties}>
    <div className="workspace-panel-tools">
      <button hidden={!leftEnabled} disabled={!stacked&&hideLeft&&budget<160} onClick={()=>setLayout(current=>({...current,hideLeft:!hideLeft}))}>{hideLeft?'Show':'Collapse'} {leftLabel}</button>
      {hasRight&&<button disabled={!stacked&&hideRight&&budget-(hideLeft?0:left)<180} title={hideRight&&budget-(hideLeft?0:left)<180?`Collapse ${leftLabel} or widen the window to show ${rightLabel}`:'Toggle FX panel'} onClick={()=>setLayout(current=>({...current,hideRight:!hideRight}))}>{hideRight?'Show':'Collapse'} {rightLabel}</button>}
    </div>
    {children}
    {!stacked&&!hideLeft&&divider('left',left)}{!stacked&&hasRight&&!hideRight&&divider('right',right)}
  </section>;
}
