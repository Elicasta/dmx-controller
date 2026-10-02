import type {ControlCommand} from '../core/control-command';
import {fixtureParameterUpdate,fixtureColorUpdates,type PatchedFixture} from './fixtures';
import {applyUniverseUpdates,type DmxUpdate} from './dmx';
import type {ShowRecording} from './show';
import type {ShowTimeline,TimelineTakeClip} from './show-design';

/** Retains explicit manual channel ownership, including setting the current value. */
export class ManualOverdub {
  readonly touched=new Set<number>();
  private emitted=new Set<number>();
  private overrides=new Map<number,number>();
  observe(command:ControlCommand,previous:readonly number[],next:readonly number[],output:readonly number[],fixtures:readonly PatchedFixture[]) {
    const base=new Set<number>();
    next.forEach((value,i)=>{if(value!==previous[i])base.add(i+1);});
    if(command.type==='frame.update')command.updates.forEach(([channel])=>base.add(channel));
    if(command.type==='frame.replace'||command.type==='frame.output.replace')next.forEach((_,i)=>base.add(i+1));
    if(command.type==='fixture.attribute'||command.type==='fixture.color'){
      for(const f of fixtures.filter(f=>command.fixtureIds.includes(f.id))){
        const updates=command.type==='fixture.attribute'?[fixtureParameterUpdate(f,command.parameter,command.value)].filter(Boolean) as DmxUpdate[]:fixtureColorUpdates(f,[command.color.red,command.color.green,command.color.blue]);
        updates.forEach(([channel])=>base.add(channel));
      }
    }
    for(const channel of base){this.overrides.set(channel,next[channel-1]);this.touched.add(channel);}
    if(command.type==='playback.layer.set')command.updates.forEach(([channel])=>this.touched.add(channel));
    if(['master.set','blackout.set','group.master.set','fixture.flash.set'].includes(command.type)){
      for(const f of fixtures){
        if(command.type==='group.master.set'&&f.group!==command.groupName)continue;
        if(command.type==='fixture.flash.set'&&!command.fixtureIds.includes(f.id))continue;
        const dimmer=fixtureParameterUpdate(f,'dimmer',0);if(dimmer)this.touched.add(dimmer[0]);
      }
      output.forEach((_,i)=>{if(command.type==='blackout.set')this.touched.add(i+1);});
    }
  }
  mix(frame:readonly number[]):number[]{return applyUniverseUpdates(frame,[...this.overrides]);}
  changes(previous:readonly number[],output:readonly number[]):DmxUpdate[]{const channels=[...this.touched].filter(c=>!this.emitted.has(c)||previous[c-1]!==output[c-1]);channels.forEach(c=>this.emitted.add(c));return channels.map(c=>[c,output[c-1]]);}
}
export function timelineCaptureClip(recording:ShowRecording,startBar:number,bpm:number,beatsPerBar:number):TimelineTakeClip {
  const durationMs=Math.max(1,recording.durationMs);
  return {id:crypto.randomUUID(),name:recording.name,recordingId:recording.id,startBar,
    lengthBars:durationMs/(60000/bpm*beatsPerBar),durationMs,trimInMs:0,trimOutMs:durationMs,enabled:true,
    mode:'override',frames:structuredClone(recording.frames)};
}
export function appendTimelineCapture(timeline:ShowTimeline,clip:TimelineTakeClip):ShowTimeline {
  if((timeline.takeClips?.length??0)>=24)throw Error('This Timeline already has 24 takes. Remove a take before recording.');
  return {...timeline,takeClips:[...timeline.takeClips??[],clip]};
}
