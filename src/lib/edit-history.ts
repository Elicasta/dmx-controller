import { useEffect, useRef } from 'react';
export function useEditHistory<T>(value:T,restore:(value:T)=>void,enabled:boolean){
  const snapshot=useRef(value), current=useRef(''), undo=useRef<T[]>([]), redo=useRef<T[]>([]), applying=useRef(false);
  const restoreRef=useRef(restore);restoreRef.current=restore;
  const encoded=JSON.stringify(value,(key,v)=>key==='selected'?undefined:v);
  useEffect(()=>{
    if(!enabled){snapshot.current=value;current.current=encoded;undo.current=[];redo.current=[];return;}
    if(applying.current){applying.current=false;snapshot.current=value;current.current=encoded;return;}
    if(encoded===current.current)return;
    undo.current.push(structuredClone(snapshot.current));undo.current=undo.current.slice(-40);redo.current=[];
    snapshot.current=value;current.current=encoded;
  },[encoded,enabled]);
  return (direction:'undo'|'redo')=>{
    const from=direction==='undo'?undo:redo,to=direction==='undo'?redo:undo;
    const next=from.current.pop();if(!next)return;
    to.current.push(structuredClone(snapshot.current));applying.current=true;snapshot.current=next;current.current=JSON.stringify(next,(key,v)=>key==='selected'?undefined:v);restoreRef.current(structuredClone(next));
  };
}
