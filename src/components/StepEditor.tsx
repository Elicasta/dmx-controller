import { useState } from 'react';
import type { CustomEffect } from '../lib/effects';
import { clearStepProgram,copyStep,pasteStep,resizeStepProgram,setStepValue,stepCount,stepValue,STEP_PARAMETERS } from '../lib/step-program';
export default function StepEditor({effect,onChange}:{effect:CustomEffect;onChange:(effect:CustomEffect)=>void}){
  const [selected,setSelected]=useState(0),[copied,setCopied]=useState<ReturnType<typeof copyStep>|null>(null),[error,setError]=useState('');
  const count=stepCount(effect),beats=effect.cycleBeats??4,resolution=count/beats,index=Math.min(selected,count-1);
  function resize(nextBeats:number,nextResolution:number){
    try{onChange(resizeStepProgram(effect,nextBeats,nextResolution));setError('');}catch(error){setError(String(error));}
  }
  return <section className="beat-step-editor" aria-label="Beat Step Editor">
    <header><strong>STEP EDITOR</strong><small>One pattern repeats on the musical grid for this layer's target.</small></header>
    <div className="step-editor-settings">
      <label>Pattern beats<input aria-label="Step pattern beats" type="number" min={1} max={32} value={beats} onChange={e=>resize(Number(e.target.value),resolution)} /></label>
      <label>Subdivision<select aria-label="Step subdivision" value={resolution} onChange={e=>resize(beats,Number(e.target.value))}>{[[1,'Beat'],[2,'½ Beat'],[3,'Triplet'],[4,'¼ Beat'],[8,'⅛ Beat'],[16,'1/16 Beat']].map(([value,label])=><option key={value} value={value} disabled={beats*Number(value)>64}>{label}</option>)}</select></label>
      <button onClick={()=>onChange(clearStepProgram(effect))}>Clear Pattern</button>
      <button onClick={()=>setCopied(copyStep(effect,index))}>Copy Step</button>
      <button disabled={!copied} onClick={()=>{if(copied)onChange(pasteStep(effect,index,copied));}}>Paste Step</button>
    </div>
    <div className="beat-step-grid">{Array.from({length:count},(_,i)=>{
      const value=stepValue(effect,'dimmer',i),beat=i/resolution;
      return <button key={i} aria-label={`Step ${i+1}, beat ${(beat+1).toFixed(2)}`} aria-pressed={value>0} className={index===i?'selected':''} style={{'--step-color':effect.colorPalette?.[i]??'#ffffff'} as import('react').CSSProperties}
        onClick={()=>{setSelected(i);onChange(setStepValue(effect,'dimmer',i,value>0?0:100));}}>
        <small>{Number.isInteger(beat)?Math.floor(beat)+1:'·'}</small><span>{value>0?'●':'○'}</span><small>{value}%</small>
      </button>;
    })}</div>
    <div className="step-value-editor">
      <strong>Step {index+1}</strong>
      <label>Color<input aria-label="Step color" type="color" value={effect.colorPalette?.[index]??'#ffffff'} onChange={e=>{
        const next=structuredClone(effect);next.colorPalette??=Array(count).fill('#ffffff');next.colorPalette[index]=e.target.value;onChange(next);
      }}/></label>
      {STEP_PARAMETERS.map(({parameter,label})=><label key={parameter}>
        {parameter!=='dimmer'&&<input aria-label={`Program step ${label}`} type="checkbox" checked={Boolean(effect.lanes?.some(l=>l.parameter===parameter))} onChange={e=>onChange(e.target.checked?setStepValue(effect,parameter,index,parameter==='pan'||parameter==='tilt'?50:0):{...effect,lanes:effect.lanes?.filter(l=>l.parameter!==parameter)})}/>}
        {label}<input aria-label={`Step ${label}`} type="number" min={0} max={100} step={1} value={stepValue(effect,parameter,index)} disabled={!effect.lanes?.some(l=>l.parameter===parameter)} onChange={e=>onChange(setStepValue(effect,parameter,index,Number(e.target.value)))}/>
      </label>)}
    </div>
    {error&&<p role="status">{error}</p>}
  </section>;
}
