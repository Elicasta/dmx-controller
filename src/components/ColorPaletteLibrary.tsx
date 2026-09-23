import { useState } from 'react';
import type { ColorPalette } from '../core/color';
export function ColorPaletteLibrary({palettes,color,disabled,onChange,onRecall}:{palettes:ColorPalette[];color:string;disabled:boolean;onChange:(p:ColorPalette[])=>void;onRecall:(color:string)=>void}) {
  const [name,setName]=useState('');const [folder,setFolder]=useState('');const [filter,setFilter]=useState('');
  const update=(id:string,patch:Partial<ColorPalette>)=>onChange(palettes.map(p=>p.id===id?{...p,...patch}:p));
  const move=(id:string,delta:number)=>{const copy=[...palettes],i=copy.findIndex(p=>p.id===id),j=i+delta;if(j<0||j>=copy.length)return;[copy[i],copy[j]]=[copy[j],copy[i]];onChange(copy);};
  return <section className="color-library"><header><strong>SHOW COLOR PALETTES</strong><small>Stored in this show. Recall targets selected RGB-capable fixtures.</small></header>
    <form onSubmit={e=>{e.preventDefault();if(!name.trim()||disabled||palettes.length>=256)return;onChange([...palettes,{id:crypto.randomUUID(),name:name.trim(),folder:folder.trim(),color}]);setName('');}}>
      <input aria-label="New color palette name" placeholder="Palette name" maxLength={64} value={name} onChange={e=>setName(e.target.value)}/><input aria-label="New color palette folder" placeholder="Folder (optional)" maxLength={64} value={folder} onChange={e=>setFolder(e.target.value)}/><button disabled={disabled||!name.trim()||palettes.length>=256}>Store Selected Color</button>
    </form>
    <input aria-label="Filter color palettes" placeholder="Filter name or folder" value={filter} onChange={e=>setFilter(e.target.value)}/>
    {palettes.filter(p=>(p.name+' '+p.folder).toLowerCase().includes(filter.toLowerCase())).map(p=><article key={p.id}>
      <button className="palette-recall" aria-label={`Recall ${p.name}`} disabled={disabled} style={{borderLeft:`12px solid ${p.color}`}} onClick={()=>onRecall(p.color)}>Recall</button>
      <input aria-label={`Rename ${p.name}`} maxLength={64} value={p.name} onChange={e=>update(p.id,{name:e.target.value})} onBlur={()=>{if(!p.name.trim())update(p.id,{name:'Color palette'});}}/>
      <input aria-label={`Folder for ${p.name}`} maxLength={64} value={p.folder} placeholder="Folder" onChange={e=>update(p.id,{folder:e.target.value})}/>
      <button disabled={disabled} onClick={()=>update(p.id,{color})}>Update color</button>
      <button aria-label={`Move ${p.name} up`} disabled={palettes[0]?.id===p.id} onClick={()=>move(p.id,-1)}>↑</button><button aria-label={`Move ${p.name} down`} disabled={palettes.at(-1)?.id===p.id} onClick={()=>move(p.id,1)}>↓</button>
      <button aria-label={`Delete ${p.name}`} onClick={()=>{if(window.confirm(`Delete color palette “${p.name}”?`))onChange(palettes.filter(x=>x.id!==p.id));}}>Delete</button>
    </article>)}
    {!palettes.length&&<p>No show colors stored yet. Choose a color, name it, then store it here.</p>}
    {disabled&&<p>Select an RGB-capable fixture to apply or store color. Wheel-only and unsupported modes remain controlled through their native attributes.</p>}
  </section>;
}
