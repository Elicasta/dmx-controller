import type { CustomEffect, CustomEffectLane } from './effects';
import type { FixtureParameter } from './fixtures';
export function createStepProgram(bpm:number,color:string):CustomEffect {
  return {id:crypto.randomUUID(),name:'Beat Steps',parameter:'color',waveform:'step',bpm,depth:100,offset:0,phaseSpread:0,cycleBeats:4,mode:'absolute',colorBlend:'step',
    colorPalette:Array(8).fill(color),lanes:[{parameter:'dimmer',waveform:'step',depth:100,offset:0,mode:'absolute',steps:Array.from({length:8},()=>({value:0}))}]};
}
export function stepCount(effect:CustomEffect):number {return effect.lanes?.find(l=>l.parameter==='dimmer')?.steps?.length??8;}
export function stepValue(effect:CustomEffect,parameter:FixtureParameter,index:number):number {
  return effect.lanes?.find(l=>l.parameter===parameter)?.steps?.[index]?.value??0;
}
export function setStepValue(effect:CustomEffect,parameter:FixtureParameter,index:number,value:number):CustomEffect {
  const next=structuredClone(effect),count=stepCount(effect);
  if(index<0||index>=count)return next;
  next.lanes??=[];
  let lane=next.lanes.find(l=>l.parameter===parameter);
  if(!lane){
    lane={parameter,waveform:'step',depth:100,offset:0,mode:'absolute',steps:Array.from({length:count},()=>({value:parameter==='pan'||parameter==='tilt'?50:0}))};
    next.lanes.push(lane);
  }
  lane.steps??=Array.from({length:count},()=>({value:0}));
  lane.steps[index]={...lane.steps[index],value:Math.max(0,Math.min(100,Number.isFinite(value)?value:0))};
  return next;
}
/** Keep events at the same beat when changing subdivisions; extending a pattern adds empty steps. */
export function resizeStepProgram(effect:CustomEffect,beats:number,subdivision:number):CustomEffect {
  const count=Math.round(beats*subdivision);
  if(!Number.isInteger(count)||count<1||count>64||beats<1||beats>32||![1,2,3,4,8,16].includes(subdivision))throw Error('Choose a pattern of at most 64 steps.');
  const next=structuredClone(effect),oldCount=stepCount(effect),oldBeats=effect.cycleBeats??4,oldResolution=oldCount/oldBeats;
  const source=(index:number)=>Math.min(oldCount-1,Math.floor(index/subdivision*oldResolution+1e-6));
  next.cycleBeats=beats;
  next.colorPalette=Array.from({length:count},(_,i)=>i/subdivision<oldBeats?(effect.colorPalette?.[source(i)]??'#ffffff'):'#ffffff');
  next.lanes=effect.lanes?.map(l=>({...l,steps:Array.from({length:count},(_,i)=>({value:i/subdivision<oldBeats?(l.steps?.[source(i)]?.value??0):0}))}));
  return next;
}
export function clearStepProgram(effect:CustomEffect):CustomEffect {
  return {...structuredClone(effect),lanes:effect.lanes?.map(l=>({...structuredClone(l),steps:l.steps?.map(s=>({...s,value:0}))}))};
}
export function copyStep(effect:CustomEffect,index:number):{color:string;values:Partial<Record<FixtureParameter,number>>}{
  return {color:effect.colorPalette?.[index]??'#ffffff',values:Object.fromEntries((effect.lanes??[]).map(l=>[l.parameter,l.steps?.[index]?.value??0]))};
}
export function pasteStep(effect:CustomEffect,index:number,step:ReturnType<typeof copyStep>):CustomEffect {
  let next=structuredClone(effect);
  for(const [parameter,value]of Object.entries(step.values))next=setStepValue(next,parameter as FixtureParameter,index,value??0);
  next.colorPalette??=Array(stepCount(next)).fill('#ffffff');next.colorPalette[index]=step.color;
  return next;
}
export const STEP_PARAMETERS:ReadonlyArray<{parameter:CustomEffectLane['parameter'];label:string}>=[
  {parameter:'dimmer',label:'Intensity / Blinder'},
  {parameter:'pan',label:'Pan'},{parameter:'tilt',label:'Tilt'},{parameter:'strobe',label:'Strobe'},
  {parameter:'white',label:'White'},{parameter:'uv',label:'UV'},
];
