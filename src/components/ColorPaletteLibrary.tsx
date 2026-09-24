import { useMemo, useState } from 'react';
import type { ColorPalette } from '../core/color';

export function ColorPaletteLibrary({palettes,color,disabled,onChange,onRecall}:{palettes:ColorPalette[];color:string;disabled:boolean;onChange:(p:ColorPalette[])=>void;onRecall:(color:string)=>void}) {
  const [name,setName]=useState('');
  const [folder,setFolder]=useState('');
  const [filter,setFilter]=useState('');
  const update=(id:string,patch:Partial<ColorPalette>)=>onChange(palettes.map(p=>p.id===id?{...p,...patch}:p));
  const move=(id:string,delta:number)=>{const copy=[...palettes],i=copy.findIndex(p=>p.id===id),j=i+delta;if(j<0||j>=copy.length)return;[copy[i],copy[j]]=[copy[j],copy[i]];onChange(copy);};
  const visible=palettes.filter(p=>(p.name+' '+p.folder).toLowerCase().includes(filter.toLowerCase()));
  const folders=useMemo(()=>{const grouped=new Map<string,ColorPalette[]>();for(const palette of visible){const key=palette.folder.trim()||'Unfiled';grouped.set(key,[...(grouped.get(key)||[]),palette]);}return [...grouped.entries()].sort(([a],[b])=>a==='Unfiled'?1:b==='Unfiled'?-1:a.localeCompare(b));},[visible]);
  return <section className="color-library">
    <header><div><strong>SHOW COLOR PALETTES</strong><small>Foldered palettes stored with this show.</small></div><b>{palettes.length} COLORS</b></header>
    <form onSubmit={e=>{e.preventDefault();if(!name.trim()||disabled||palettes.length>=256)return;onChange([...palettes,{id:crypto.randomUUID(),name:name.trim(),folder:folder.trim(),color}]);setName('');}}>
      <input aria-label="New color palette name" placeholder="Palette name" maxLength={64} value={name} onChange={e=>setName(e.target.value)}/>
      <input aria-label="New color palette folder" placeholder="Folder, e.g. Worship / Warm" maxLength={64} value={folder} onChange={e=>setFolder(e.target.value)}/>
      <button disabled={disabled||!name.trim()||palettes.length>=256}>Store Color</button>
    </form>
    <input className="palette-filter" aria-label="Filter color palettes" placeholder="Search palettes or folders…" value={filter} onChange={e=>setFilter(e.target.value)}/>
    <div className="color-folder-stack">
      {folders.map(([folderName,items])=><details className="color-folder" key={folderName} open>
        <summary><span>▾</span><strong>{folderName}</strong><b>{items.length}</b></summary>
        <div className="color-folder-grid">{items.map(p=><article key={p.id}>
          <button className="palette-recall" aria-label={`Recall ${p.name}`} disabled={disabled} onClick={()=>onRecall(p.color)}><i style={{background:p.color}}/><span><strong>{p.name}</strong><small>{p.color.toUpperCase()}</small></span></button>
          <div className="palette-edit-row"><input aria-label={`Rename ${p.name}`} maxLength={64} value={p.name} onChange={e=>update(p.id,{name:e.target.value})} onBlur={()=>{if(!p.name.trim())update(p.id,{name:'Color palette'});}}/><input aria-label={`Folder for ${p.name}`} maxLength={64} value={p.folder} placeholder="Folder" onChange={e=>update(p.id,{folder:e.target.value})}/></div>
          <div className="palette-actions"><button disabled={disabled} onClick={()=>update(p.id,{color})}>Update</button><button aria-label={`Move ${p.name} up`} disabled={palettes[0]?.id===p.id} onClick={()=>move(p.id,-1)}>↑</button><button aria-label={`Move ${p.name} down`} disabled={palettes.at(-1)?.id===p.id} onClick={()=>move(p.id,1)}>↓</button><button aria-label={`Delete ${p.name}`} onClick={()=>{if(window.confirm(`Delete color palette “${p.name}”?`))onChange(palettes.filter(x=>x.id!==p.id));}}>Delete</button></div>
        </article>)}</div>
      </details>)}
    </div>
    {!visible.length&&<p>{palettes.length?'No palettes match that filter.':'No show colors stored yet. Choose a color, name it, and optionally place it in a folder.'}</p>}
    {disabled&&<p>Select an RGB-capable fixture to apply or store color.</p>}
  </section>;
}